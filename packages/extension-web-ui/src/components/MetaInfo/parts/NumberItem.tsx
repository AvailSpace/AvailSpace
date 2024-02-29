// Copyright 2019-2022 @subwallet/extension-web-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Number } from '@subwallet/react-ui';
import BigN from 'bignumber.js';
import CN from 'classnames';
import React from 'react';
import styled from 'styled-components';

import { InfoItemBase } from './types';

export interface NumberInfoItem extends Omit<InfoItemBase, 'valueColorSchema'> {
  value: string | number | BigN
  suffix?: string
  prefix?: string
  decimals?: number
  valueColorSchema?: InfoItemBase['valueColorSchema'] | 'even-odd'
  decimalOpacity?: number
  size?: number
  subFloatNumber?: boolean
  suffixNode?: React.ReactNode
  onClickValue?: VoidFunction;
  disableClickValue?: boolean;
}

const Component: React.FC<NumberInfoItem> = (props: NumberInfoItem) => {
  const { className,
    decimalOpacity = 1,
    decimals = 0,
    disableClickValue,
    label,
    onClickValue,
    prefix,
    size = 30,
    subFloatNumber = false,
    suffix,
    suffixNode, value, valueColorSchema = 'default' } = props;

  return (
    <div className={CN(className, '__row -type-number')}>
      {
        !!label && (
          <div className={'__col __label-col'}>
            <div className={'__label'}>
              {label}
            </div>
          </div>
        )
      }
      <div className={'__col __value-col -to-right'}>
        <div
          className={CN(
            `__number-item __value -is-wrapper -schema-${valueColorSchema}`,
            {
              '-disabled': disableClickValue,
              '-clickable': !!onClickValue
            }
          )}
          onClick={!disableClickValue ? onClickValue : undefined}
        >
          <Number
            decimal={decimals}
            decimalOpacity={decimalOpacity}
            intOpacity={1}
            prefix={prefix}
            size={size}
            subFloatNumber={subFloatNumber}
            suffix={suffix}
            unitOpacity={1}
            value={value}
          />
          {suffixNode}
        </div>
      </div>
    </div>
  );
};

const NumberItem = styled(Component)<NumberInfoItem>(
  ({ theme: { token } }: NumberInfoItem) => {
    return {};
  }
);

export default NumberItem;
