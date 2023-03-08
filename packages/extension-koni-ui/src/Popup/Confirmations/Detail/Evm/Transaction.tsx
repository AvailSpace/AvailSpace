// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { EvmSendTransactionRequest, EvmTransactionArg } from '@subwallet/extension-base/background/KoniTypes';
import { AccountJson } from '@subwallet/extension-base/background/types';
import MetaInfo from '@subwallet/extension-koni-ui/components/MetaInfo';
import useGetAccountByAddress from '@subwallet/extension-koni-ui/hooks/account/useGetAccountByAddress';
import useGetChainInfoByChainId from '@subwallet/extension-koni-ui/hooks/chain/useGetChainInfoByChainId';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

interface Props extends ThemeProps {
  request: EvmSendTransactionRequest;
  account: AccountJson;
}

const convertToBigN = (num: EvmSendTransactionRequest['value']): string | number | undefined => {
  if (typeof num === 'object') {
    return num.toNumber();
  } else {
    return num;
  }
};

const Component: React.FC<Props> = (props: Props) => {
  const { account, className, request } = props;
  const { chainId } = request;

  const recipient = useGetAccountByAddress(request.to);

  const chainInfo = useGetChainInfoByChainId(chainId);

  const { t } = useTranslation();

  const handlerRenderArg = useCallback((data: EvmTransactionArg, parentName: string): JSX.Element => {
    const { children, name, value } = data;
    const _name = (parentName ? `${parentName}.` : '') + name;

    if (children) {
      return (
        <React.Fragment key={parentName}>
          {
            children.map((child) => handlerRenderArg(child, name))
          }
        </React.Fragment>
      );
    }

    return (
      <MetaInfo.Data
        key={_name}
        label={_name}
      >
        {value}
      </MetaInfo.Data>
    );
  }, []);

  const renderInputInfo = useCallback((): React.ReactNode => {
    const data = request.parseData;

    if (typeof data === 'string') {
      return null;
    }

    return (
      <>
        <MetaInfo.Default
          label={t('Method')}
          labelAlign='top'
        >
          {data.methodName}
        </MetaInfo.Default>
        <MetaInfo.Data
          className='arg-container'
          label={t('Arguments')}
        >
          {
            data.args.map((value) => handlerRenderArg(value, ''))
          }
        </MetaInfo.Data>
      </>
    );
  }, [handlerRenderArg, request.parseData, t]);

  return (
    <MetaInfo className={className}>
      {
        chainInfo
          ? (
            <MetaInfo.Chain
              chain={chainInfo.slug}
              chainName={chainInfo.name}
              label={t<string>('Network')}
            />
          )
          : chainId !== undefined
            ? (
              <MetaInfo.Default
                label={t<string>('Chain id')}
              >
                {chainId}
              </MetaInfo.Default>
            )
            : null
      }
      <MetaInfo.Transfer
        recipientAddress={recipient?.address || request.to || ''}
        recipientLabel={t('To')}
        recipientName={recipient?.name || ''}
        senderAddress={account.address}
        senderLabel={t('From')}
        senderName={account.name}
      />
      <MetaInfo.Number
        decimals={chainInfo?.evmInfo?.decimals}
        label={t('Amount')}
        suffix={chainInfo?.evmInfo?.symbol}
        value={convertToBigN(request.value) || 0}
      />
      <MetaInfo.Number
        decimals={chainInfo?.evmInfo?.decimals}
        label={t('Estimate gas')}
        suffix={chainInfo?.evmInfo?.symbol}
        value={request.estimateGas}
      />
      {renderInputInfo()}
      {
        (request.data && request.data !== '0x') &&
          (
            <MetaInfo.Data label={t('Hex data')}>
              <details>
                <summary>{request.data}</summary>
              </details>
            </MetaInfo.Data>
          )
      }
    </MetaInfo>
  );
};

const EvmTransactionDetail = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    '.__chain-item, .__status-item, .__account-item': {
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
      gap: token.sizeXS
    },

    '.__label': {
      fontFamily: token.fontFamily,
      textTransform: 'unset'
    },

    '.arg-container > .__col > .__value': {
      marginLeft: token.marginXS
    },

    '.-to-right': {
      textAlign: 'right'
    },

    details: {
      cursor: 'pointer',

      summary: {
        textOverflow: 'ellipsis',
        outline: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap'
      },

      '&[open] summary': {
        whiteSpace: 'normal'
      },

      pre: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }
    }
  };
});

export default EvmTransactionDetail;
