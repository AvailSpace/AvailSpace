// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useSelector } from '@subwallet/extension-web-ui/hooks';
import { RootState } from '@subwallet/extension-web-ui/stores';
import { Theme } from '@subwallet/extension-web-ui/themes';
import { ThemeProps } from '@subwallet/extension-web-ui/types';
import { BalanceItemProps, Number } from '@subwallet/react-ui';
import classNames from 'classnames';
import React, { Context, useContext } from 'react';
import styled, { ThemeContext } from 'styled-components';

type Props = ThemeProps & {
  onPressItem?: BalanceItemProps['onPressItem'],
  value: number,
  pastValue: number,
};

function Component (
  { className = '',
    pastValue,
    value }: Props) {
  // todo: Update BalanceItem in react-ui lib
  // - loading
  // - auto detect logo, only use logoKey
  // - price change status

  const token = useContext<Theme>(ThemeContext as Context<Theme>).token;
  const { currency } = useSelector((state: RootState) => state.price);
  const isShowBalance = useSelector((state: RootState) => state.settings.isShowBalance);
  const priceChangeStatus = (() => {
    if (value > pastValue) {
      return 'increase';
    } else if (value < pastValue) {
      return 'decrease';
    }

    return null;
  })();

  const marginColor = priceChangeStatus === 'decrease' ? token.colorError : token.colorSuccess;
  const margin = !pastValue || !value ? 0 : Math.abs(pastValue - value) / pastValue * 100;

  return (
    <div className={classNames('token-price', className, {
      '-price-decrease': priceChangeStatus === 'decrease'
    })}
    >
      <div className={'__token-price-wrapper'}>
        <Number
          className={'__value'}
          decimal={0}
          decimalOpacity={0.45}
          prefix={(currency?.isPrefix && currency?.symbol) || ''}
          value={value}
        />
        {isShowBalance && <div className={'__total-balance-symbol'}>
          {currency.symbol}
        </div>}
      </div>
      <Number
        className={'__percentage'}
        decimal={0}
        decimalColor={marginColor}
        intColor={marginColor}
        prefix={priceChangeStatus === 'decrease' ? '-' : '+'}
        suffix='%'
        unitColor={marginColor}
        value={margin}
      />
    </div>
  );
}

export const TokenPrice = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return ({
    '.ant-number .ant-typography': {
      fontSize: 'inherit !important',
      lineHeight: 'inherit',
      textAlign: 'end'
    },
    '.__token-price-wrapper': {
      display: 'flex',
      justifyContent: 'end',
      gap: 2
    },

    '.__value': {
      lineHeight: token.lineHeightLG,
      fontSize: token.fontSizeLG
    },

    '.__percentage': {
      lineHeight: token.lineHeightSM,
      fontSize: token.fontSizeSM
    }
  });
});
