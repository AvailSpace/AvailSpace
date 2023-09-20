// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { COMMON_CHAIN_SLUGS } from '@subwallet/chain-list';
import { _ChainInfo } from '@subwallet/chain-list/types';
import { TransactionError } from '@subwallet/extension-base/background/errors/TransactionError';
import { ExtrinsicType, OptimalYieldPath, OptimalYieldPathParams, RequestCrossChainTransfer, SubmitAcalaLiquidStaking, YieldPoolInfo, YieldProcessValidation, YieldStepType, YieldValidationStatus } from '@subwallet/extension-base/background/KoniTypes';
import { createXcmExtrinsic } from '@subwallet/extension-base/koni/api/xcm';
import { calculateAlternativeFee, DEFAULT_YIELD_FIRST_STEP, fakeAddress, RuntimeDispatchInfo } from '@subwallet/extension-base/koni/api/yield/utils';
import { _SubstrateApi } from '@subwallet/extension-base/services/chain-service/types';
import { _getChainNativeTokenSlug, _getTokenOnChainInfo } from '@subwallet/extension-base/services/chain-service/utils';

import { SubmittableExtrinsic } from '@polkadot/api/types';
import { BN, BN_ZERO } from '@polkadot/util';

const YEAR = 365 * 24 * 60 * 60 * 1000;

export async function subscribeAcalaLiquidStakingStats (chainApi: _SubstrateApi, chainInfoMap: Record<string, _ChainInfo>, poolInfo: YieldPoolInfo, callback: (rs: YieldPoolInfo) => void) {
  const substrateApi = await chainApi.isReady;

  const [_bumpEraFrequency, _commissionRate, _estimatedRewardRatePerEra] = await Promise.all([
    substrateApi.api.query.homa.bumpEraFrequency(),
    substrateApi.api.query.homa.commissionRate(),
    substrateApi.api.query.homa.estimatedRewardRatePerEra()
  ]);

  const eraFrequency = _bumpEraFrequency.toPrimitive() as number;
  const commissionRate = _commissionRate.toPrimitive() as number;
  const estimatedRewardRate = _estimatedRewardRatePerEra.toPrimitive() as number;

  console.log('here', eraFrequency, commissionRate, estimatedRewardRate, YEAR);

  function getPoolStat () {
    // eslint-disable-next-line node/no-callback-literal
    callback({
      ...poolInfo,
      stats: {
        assetEarning: [
          {
            slug: poolInfo.inputAssets[0],
            apr: 18.38
          }
        ],
        maxCandidatePerFarmer: 1,
        maxWithdrawalRequestPerFarmer: 1,
        minJoinPool: '10000000000',
        minWithdrawal: '0',
        totalApr: 18.38,
        tvl: '13095111106588368'
      }
    });
  }

  // eslint-disable-next-line node/no-callback-literal
  callback({
    ...poolInfo,
    stats: {
      assetEarning: [
        {
          slug: poolInfo.inputAssets[0],
          apr: 18.38
        }
      ],
      maxCandidatePerFarmer: 1,
      maxWithdrawalRequestPerFarmer: 1,
      minJoinPool: '10000000000',
      minWithdrawal: '0',
      totalApr: 18.38,
      tvl: '13095111106588368'
    }
  });

  const interval = setInterval(getPoolStat, 3000000);

  return () => {
    clearInterval(interval);
  };
}

export async function generatePathForAcalaLiquidStaking (params: OptimalYieldPathParams): Promise<OptimalYieldPath> {
  const bnAmount = new BN(params.amount);
  const result: OptimalYieldPath = {
    totalFee: [],
    steps: [DEFAULT_YIELD_FIRST_STEP]
  };

  const inputTokenSlug = params.poolInfo.inputAssets[0]; // assume that the pool only has 1 input token, will update later
  const inputTokenInfo = params.assetInfoMap[inputTokenSlug];

  const inputTokenBalance = params.balanceMap[inputTokenSlug]?.free || '0';
  const bnInputTokenBalance = new BN(inputTokenBalance);

  const defaultFeeTokenSlug = params.poolInfo.feeAssets[0];
  const defaultFeeTokenBalance = params.balanceMap[defaultFeeTokenSlug]?.free || '0';
  const bnDefaultFeeTokenBalance = new BN(defaultFeeTokenBalance);

  const canPayFeeWithInputToken = params.poolInfo.feeAssets.includes(inputTokenSlug); // TODO

  const poolOriginSubstrateApi = await params.substrateApiMap[params.poolInfo.chain].isReady;

  if (!bnInputTokenBalance.gte(bnAmount)) {
    if (params.poolInfo.altInputAssets) {
      const remainingAmount = bnAmount.sub(bnInputTokenBalance);

      const altInputTokenSlug = params.poolInfo.altInputAssets[0];
      const altInputTokenInfo = params.assetInfoMap[altInputTokenSlug];

      const altInputTokenBalance = params.balanceMap[altInputTokenSlug]?.free || '0';
      const bnAltInputTokenBalance = new BN(altInputTokenBalance);

      if (bnAltInputTokenBalance.gt(BN_ZERO)) {
        const xcmAmount = bnAltInputTokenBalance.sub(remainingAmount);

        result.steps.push({
          id: result.steps.length,
          metadata: {
            sendingValue: xcmAmount.toString(),
            originTokenInfo: altInputTokenInfo,
            destinationTokenInfo: inputTokenInfo
          },
          name: 'Transfer DOT from Polkadot',
          type: YieldStepType.XCM
        });

        const xcmOriginSubstrateApi = await params.substrateApiMap[altInputTokenInfo.originChain].isReady;

        const xcmTransfer = await createXcmExtrinsic({
          originTokenInfo: altInputTokenInfo,
          destinationTokenInfo: inputTokenInfo,
          sendingValue: bnAmount.toString(),
          recipient: fakeAddress,
          chainInfoMap: params.chainInfoMap,
          substrateApi: xcmOriginSubstrateApi
        });

        const _xcmFeeInfo = await xcmTransfer.paymentInfo(fakeAddress);
        const xcmFeeInfo = _xcmFeeInfo.toPrimitive() as unknown as RuntimeDispatchInfo;
        // TODO: calculate fee for destination chain

        result.totalFee.push({
          slug: altInputTokenSlug,
          amount: xcmFeeInfo.partialFee.toString()
        });
      }
    }
  }

  result.steps.push({
    id: result.steps.length,
    name: 'Mint LDOT',
    type: YieldStepType.MINT_LDOT
  });

  const _mintFeeInfo = await poolOriginSubstrateApi.api.tx.homa.mint(params.amount).paymentInfo(fakeAddress);
  const mintFeeInfo = _mintFeeInfo.toPrimitive() as unknown as RuntimeDispatchInfo;

  if (bnDefaultFeeTokenBalance.gte(BN_ZERO)) {
    result.totalFee.push({
      slug: defaultFeeTokenSlug,
      amount: mintFeeInfo.partialFee.toString()
    });
  } else {
    if (canPayFeeWithInputToken) {
      result.totalFee.push({
        slug: inputTokenSlug, // TODO
        amount: calculateAlternativeFee(mintFeeInfo).toString()
      });
    }
  }

  return result;
}

export function validateProcessForAcalaLiquidStaking (params: OptimalYieldPathParams, path: OptimalYieldPath): TransactionError[] {
  const errors: TransactionError[] = [];
  const processValidation: YieldProcessValidation = {
    ok: true,
    status: YieldValidationStatus.OK
  };

  const bnAmount = new BN(params.amount);
  const inputTokenSlug = params.poolInfo.inputAssets[0]; // TODO
  const bnInputTokenBalance = new BN(params.balanceMap[inputTokenSlug]?.free || '0');

  if (path.steps[0].type === YieldStepType.XCM && params.poolInfo.altInputAssets) { // if xcm
    const missingAmount = bnAmount.sub(bnInputTokenBalance); // TODO: what if input token is not LOCAL ??
    const xcmFee = new BN(path.totalFee[0].amount || '0');
    const xcmAmount = missingAmount.add(xcmFee);

    const altInputTokenSlug = params.poolInfo.altInputAssets[0];
    const bnAltInputTokenBalance = new BN(params.balanceMap[altInputTokenSlug]?.free || '0');
    const altInputTokenMinAmount = new BN(params.assetInfoMap[altInputTokenSlug].minAmount || '0');

    if (!bnAltInputTokenBalance.sub(xcmAmount).gte(altInputTokenMinAmount)) {
      processValidation.failedStep = path.steps[0];
      processValidation.ok = false;
      processValidation.status = YieldValidationStatus.NOT_ENOUGH_MIN_AMOUNT;

      errors.push(new TransactionError(YieldValidationStatus.NOT_ENOUGH_MIN_AMOUNT, processValidation.message, processValidation));

      return errors;
    }
  }

  const submitStep = path.steps[0].type === YieldStepType.XCM ? path.steps[1] : path.steps[0];
  const feeTokenSlug = path.totalFee[submitStep.id].slug;
  const defaultFeeTokenSlug = params.poolInfo.feeAssets[0];

  if (feeTokenSlug === defaultFeeTokenSlug) {
    const bnFeeAmount = new BN(path.totalFee[submitStep.id]?.amount || '0');
    const bnFeeTokenBalance = new BN(params.balanceMap[feeTokenSlug]?.free || '0');
    const bnFeeTokenMinAmount = new BN(params.assetInfoMap[feeTokenSlug]?.minAmount || '0');

    if (!bnFeeTokenBalance.sub(bnFeeAmount).gte(bnFeeTokenMinAmount)) {
      processValidation.failedStep = path.steps[submitStep.id];
      processValidation.ok = false;
      processValidation.status = YieldValidationStatus.NOT_ENOUGH_FEE;

      errors.push(new TransactionError(YieldValidationStatus.NOT_ENOUGH_FEE, processValidation.message, processValidation));

      return errors;
    }

    if (!bnAmount.gte(new BN(params.poolInfo.stats?.minJoinPool || '0'))) {
      processValidation.failedStep = path.steps[submitStep.id];
      processValidation.ok = false;
      processValidation.status = YieldValidationStatus.NOT_ENOUGH_MIN_AMOUNT;

      errors.push(new TransactionError(YieldValidationStatus.NOT_ENOUGH_MIN_AMOUNT, processValidation.message, processValidation));

      return errors;
    }
  } else {
    const bnFeeAmount = new BN(path.totalFee[submitStep.id]?.amount || '0');

    // paying fee with input token
    if (!bnAmount.sub(bnFeeAmount).gte(new BN(params.poolInfo.stats?.minJoinPool || '0'))) {
      processValidation.failedStep = path.steps[submitStep.id];
      processValidation.ok = false;
      processValidation.status = YieldValidationStatus.NOT_ENOUGH_MIN_AMOUNT;

      errors.push(new TransactionError(YieldValidationStatus.NOT_ENOUGH_MIN_AMOUNT, processValidation.message, processValidation));

      return errors;
    }
  }

  return errors;
}

export async function getAcalaLiquidStakingExtrinsic (address: string, params: OptimalYieldPathParams, path: OptimalYieldPath, currentStep: number, inputData: SubmitAcalaLiquidStaking): Promise<[string, ExtrinsicType, SubmittableExtrinsic<'promise'>, any]> {
  if (path.steps[currentStep].type === YieldStepType.XCM) {
    const destinationTokenSlug = params.poolInfo.inputAssets[0];
    const originChainInfo = params.chainInfoMap[COMMON_CHAIN_SLUGS.POLKADOT];
    const originTokenSlug = _getChainNativeTokenSlug(originChainInfo);
    const originTokenInfo = params.assetInfoMap[originTokenSlug];
    const destinationTokenInfo = params.assetInfoMap[destinationTokenSlug];
    const substrateApi = params.substrateApiMap[originChainInfo.slug];

    const extrinsic = await createXcmExtrinsic({
      chainInfoMap: params.chainInfoMap,
      destinationTokenInfo,
      originTokenInfo,
      recipient: address,
      sendingValue: inputData.amount,
      substrateApi
    });

    const xcmData: RequestCrossChainTransfer = {
      originNetworkKey: originChainInfo.slug,
      destinationNetworkKey: destinationTokenInfo.originChain,
      from: address,
      to: address,
      value: inputData.amount,
      tokenSlug: originTokenSlug
    };

    return [originChainInfo.slug, ExtrinsicType.TRANSFER_XCM, extrinsic, xcmData];
  }

  const substrateApi = await params.substrateApiMap[params.poolInfo.chain].isReady;
  const extrinsic = substrateApi.api.tx.homa.mint(inputData.amount);

  return [params.poolInfo.chain, ExtrinsicType.MINT_LDOT, extrinsic, undefined];
}