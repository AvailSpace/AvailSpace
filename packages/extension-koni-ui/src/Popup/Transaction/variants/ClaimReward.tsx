// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _ChainInfo } from '@subwallet/chain-list/types';
import { ExtrinsicType } from '@subwallet/extension-base/background/KoniTypes';
import { AccountJson } from '@subwallet/extension-base/background/types';
import { _getSubstrateGenesisHash, _isChainEvmCompatible } from '@subwallet/extension-base/services/chain-service/utils';
import { _STAKING_CHAIN_GROUP } from '@subwallet/extension-base/services/earning-service/constants';
import { EarningRewardItem, YieldPoolType, YieldPositionInfo } from '@subwallet/extension-base/types';
import { isSameAddress } from '@subwallet/extension-base/utils';
import { AccountSelector, HiddenInput, MetaInfo, PageWrapper } from '@subwallet/extension-koni-ui/components';
import { BN_ZERO } from '@subwallet/extension-koni-ui/constants';
import { DataContext } from '@subwallet/extension-koni-ui/contexts/DataContext';
import { useGetNativeTokenBasicInfo, useHandleSubmitTransaction, useInitValidateTransaction, usePreCheckAction, useRestoreTransaction, useSelector, useSetCurrentPage, useTransactionContext, useWatchTransaction } from '@subwallet/extension-koni-ui/hooks';
import { useYieldPositionDetail } from '@subwallet/extension-koni-ui/hooks/earning';
import { yieldSubmitStakingClaimReward } from '@subwallet/extension-koni-ui/messaging';
import { ClaimRewardParams, FormCallbacks, FormFieldData, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { convertFieldToObject, isAccountAll, simpleCheckForm } from '@subwallet/extension-koni-ui/utils';
import { Button, Checkbox, Form, Icon } from '@subwallet/react-ui';
import BigN from 'bignumber.js';
import CN from 'classnames';
import { ArrowCircleRight, XCircle } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { isEthereumAddress } from '@polkadot/util-crypto';

import { FreeBalance, TransactionContent, TransactionFooter } from '../parts';

type Props = ThemeProps;

const hideFields: Array<keyof ClaimRewardParams> = ['chain', 'slug', 'asset'];
const validateFields: Array<keyof ClaimRewardParams> = ['from'];

const filterAccount = (
  chainInfoMap: Record<string, _ChainInfo>,
  yieldPositions: YieldPositionInfo[],
  rewardList: EarningRewardItem[],
  poolType: YieldPoolType,
  poolChain?: string
): ((account: AccountJson) => boolean) => {
  const _poolChain = poolChain || '';
  const chain = chainInfoMap[_poolChain];

  return (account: AccountJson): boolean => {
    if (!chain) {
      return false;
    }

    if (account.originGenesisHash && _getSubstrateGenesisHash(chain) !== account.originGenesisHash) {
      return false;
    }

    if (isAccountAll(account.address)) {
      return false;
    }

    if (account.isReadOnly) {
      return false;
    }

    const isEvmChain = _isChainEvmCompatible(chain);

    if (isEvmChain !== isEthereumAddress(account.address)) {
      return false;
    }

    const nominatorMetadata = yieldPositions.find((value) => isSameAddress(value.address, account.address));

    if (!nominatorMetadata) {
      return false;
    }

    const reward = rewardList.find((value) => isSameAddress(value.address, account.address));

    const isAstarNetwork = _STAKING_CHAIN_GROUP.astar.includes(_poolChain);
    const isAmplitudeNetwork = _STAKING_CHAIN_GROUP.amplitude.includes(_poolChain);
    const bnUnclaimedReward = new BigN(reward?.unclaimedReward || '0');

    return (
      ((poolType === YieldPoolType.NOMINATION_POOL || isAmplitudeNetwork) && bnUnclaimedReward.gt(BN_ZERO)) ||
      isAstarNetwork
    );
  };
};

const Component: React.FC<Props> = (props: Props) => {
  useSetCurrentPage('/transaction/claim-reward');
  const { className } = props;

  const navigate = useNavigate();

  const dataContext = useContext(DataContext);
  const { defaultData, onDone, persistData } = useTransactionContext<ClaimRewardParams>();
  const { slug } = defaultData;

  const [form] = Form.useForm<ClaimRewardParams>();
  const formDefault = useMemo((): ClaimRewardParams => ({ ...defaultData }), [defaultData]);

  const { isAllAccount } = useSelector((state) => state.accountState);
  const { chainInfoMap } = useSelector((state) => state.chainStore);
  const { earningRewards, poolInfoMap } = useSelector((state) => state.earning);

  const fromValue = useWatchTransaction('from', form, defaultData);
  const chainValue = useWatchTransaction('chain', form, defaultData);

  const poolInfo = useMemo(() => poolInfoMap[slug], [poolInfoMap, slug]);
  const poolType = poolInfo.type;
  const poolChain = poolInfo.chain;

  const { list: allPositions } = useYieldPositionDetail(slug);
  const { decimals, symbol } = useGetNativeTokenBasicInfo(chainValue);

  const [isDisable, setIsDisable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isBalanceReady, setIsBalanceReady] = useState(true);

  const { onError, onSuccess } = useHandleSubmitTransaction(onDone);

  const reward = useMemo((): EarningRewardItem | undefined => {
    return earningRewards.find((item) => item.slug === slug && item.address === fromValue);
  }, [earningRewards, fromValue, slug]);

  const rewardList = useMemo((): EarningRewardItem[] => {
    return earningRewards.filter((item) => item.slug === slug);
  }, [earningRewards, slug]);

  const goHome = useCallback(() => {
    navigate('/home/staking');
  }, [navigate]);

  const onFieldsChange: FormCallbacks<ClaimRewardParams>['onFieldsChange'] = useCallback((changedFields: FormFieldData[], allFields: FormFieldData[]) => {
    // TODO: field change
    const { empty, error } = simpleCheckForm(allFields, ['--asset']);

    const allMap = convertFieldToObject<ClaimRewardParams>(allFields);

    setIsDisable(error || empty);
    persistData(allMap);
  }, [persistData]);

  const { t } = useTranslation();

  const onSubmit: FormCallbacks<ClaimRewardParams>['onFinish'] = useCallback((values: ClaimRewardParams) => {
    setLoading(true);

    const { bondReward, from, slug } = values;

    setTimeout(() => {
      yieldSubmitStakingClaimReward({
        address: from,
        bondReward: bondReward,
        slug,
        unclaimedReward: reward?.unclaimedReward
      })
        .then(onSuccess)
        .catch(onError)
        .finally(() => {
          setLoading(false);
        });
    }, 300);
  }, [onError, onSuccess, reward?.unclaimedReward]);

  const checkAction = usePreCheckAction(fromValue);

  const accountSelectorFilter = useCallback((account: AccountJson): boolean => {
    return filterAccount(chainInfoMap, allPositions, rewardList, poolType, poolChain)(account);
  }, [chainInfoMap, allPositions, rewardList, poolType, poolChain]);

  useRestoreTransaction(form);
  useInitValidateTransaction(validateFields, form, defaultData);

  useEffect(() => {
    form.setFieldValue('chain', poolChain);
  }, [form, poolChain]);

  return (
    <>
      <TransactionContent>
        <PageWrapper resolve={dataContext.awaitStores(['earning'])}>
          <Form
            className={CN(className, 'form-container form-space-sm')}
            form={form}
            initialValues={formDefault}
            onFieldsChange={onFieldsChange}
            onFinish={onSubmit}
          >
            <HiddenInput fields={hideFields} />
            <Form.Item
              name={'from'}
            >
              <AccountSelector
                disabled={!isAllAccount}
                filter={accountSelectorFilter}
              />
            </Form.Item>
            <FreeBalance
              address={fromValue}
              chain={chainValue}
              className={'free-balance'}
              label={t('Available balance:')}
              onBalanceReady={setIsBalanceReady}
            />
            <Form.Item>
              <MetaInfo
                className='claim-reward-meta-info'
                hasBackgroundWrapper={true}
              >
                <MetaInfo.Chain
                  chain={chainValue}
                  label={t('Network')}
                />
                {
                  reward?.unclaimedReward && (
                    <MetaInfo.Number
                      decimals={decimals}
                      label={t('Reward claiming')}
                      suffix={symbol}
                      value={reward.unclaimedReward}
                    />
                  )
                }
              </MetaInfo>
            </Form.Item>
            <Form.Item
              name={'bondReward'}
              valuePropName='checked'
            >
              <Checkbox>
                <span className={'__option-label'}>{t('Bond reward after claim')}</span>
              </Checkbox>
            </Form.Item>
          </Form>
        </PageWrapper>
      </TransactionContent>
      <TransactionFooter
        errors={[]}
        warnings={[]}
      >
        <Button
          disabled={loading}
          icon={(
            <Icon
              phosphorIcon={XCircle}
              weight='fill'
            />
          )}
          onClick={goHome}
          schema={'secondary'}
        >
          {t('Cancel')}
        </Button>

        <Button
          disabled={isDisable || !isBalanceReady}
          icon={(
            <Icon
              phosphorIcon={ArrowCircleRight}
              weight='fill'
            />
          )}
          loading={loading}
          onClick={checkAction(form.submit, ExtrinsicType.STAKING_CLAIM_REWARD)}
        >
          {t('Continue')}
        </Button>
      </TransactionFooter>
    </>
  );
};

const ClaimReward = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    '.unstaked-field, .free-balance': {
      marginBottom: token.marginXS
    },

    '.meta-info': {
      marginTop: token.paddingSM
    },

    '.cancel-unstake-info-item > .__col': {
      flex: 'initial',
      paddingRight: token.paddingXXS
    },

    '.claim-reward-meta-info': {
      marginTop: token.marginXXS
    },

    '.ant-checkbox-wrapper': {
      display: 'flex',
      alignItems: 'center',

      '.ant-checkbox': {
        top: 0
      }
    }
  };
});

export default ClaimReward;
