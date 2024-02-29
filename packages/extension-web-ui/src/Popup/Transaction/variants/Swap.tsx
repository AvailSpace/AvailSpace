// Copyright 2019-2022 @subwallet/extension-web-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _ChainAsset } from '@subwallet/chain-list/types';
import { _getAssetDecimals, _getAssetOriginChain, _getAssetSymbol } from '@subwallet/extension-base/services/chain-service/utils';
import { SwapQuote } from '@subwallet/extension-base/types/swap';
import { AccountSelector, AddressInput, HiddenInput, PageWrapper, SwapFromField, SwapToField } from '@subwallet/extension-web-ui/components';
import { AllSwapQuotes } from '@subwallet/extension-web-ui/components/Modal/Swap';
import AddMoreBalanceModal from '@subwallet/extension-web-ui/components/Modal/Swap/AddMoreBalanceModal';
import ChooseFeeTokenModal from '@subwallet/extension-web-ui/components/Modal/Swap/ChooseFeeTokenModal';
import SwapRoute from '@subwallet/extension-web-ui/components/Swap/SwapRoute';
import { SWAP_ALL_QUOTES_MODAL, SWAP_CHOOSE_FEE_TOKEN_MODAL, SWAP_MORE_BALANCE_MODAL, SWAP_SLIPPAGE_MODAL } from '@subwallet/extension-web-ui/constants';
import { DataContext } from '@subwallet/extension-web-ui/contexts/DataContext';
import { ScreenContext } from '@subwallet/extension-web-ui/contexts/ScreenContext';
import { useSelector, useTransactionContext, useWatchTransaction } from '@subwallet/extension-web-ui/hooks';
import { handleSwapRequest } from '@subwallet/extension-web-ui/messaging/transaction/swap';
import { FreeBalance, TransactionContent, TransactionFooter } from '@subwallet/extension-web-ui/Popup/Transaction/parts';
import { FormCallbacks, SwapParams, ThemeProps, TokenSelectorItemType } from '@subwallet/extension-web-ui/types';
import { BackgroundIcon, Button, Form, Icon, ModalContext, Number } from '@subwallet/react-ui';
import { Rule } from '@subwallet/react-ui/es/form';
import CN from 'classnames';
import { ArrowsDownUp, CaretDown, CaretRight, CaretUp, Info, PencilSimpleLine, PlusCircle } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { isAddress } from '@polkadot/util-crypto';

import MetaInfo from '../../../components/MetaInfo/MetaInfo';
import SlippageModal from '../../../components/Modal/Swap/SlippageModal';

type Props = ThemeProps;

const hideFields: Array<keyof SwapParams> = ['fromAmount', 'fromTokenSlug', 'toTokenSlug'];

function getTokenSelectorItem (tokenSlugs: string[], assetRegistryMap: Record<string, _ChainAsset>): TokenSelectorItemType[] {
  const result: TokenSelectorItemType[] = [];

  tokenSlugs.forEach((slug) => {
    const asset = assetRegistryMap[slug];

    if (asset) {
      result.push({
        originChain: asset.originChain,
        slug,
        symbol: asset.symbol,
        name: asset.name
      });
    }
  });

  return result;
}

function getDecimals (assetInfo?: _ChainAsset) {
  return assetInfo ? _getAssetDecimals(assetInfo) : 0;
}

function getSymbol (assetInfo?: _ChainAsset) {
  return assetInfo ? _getAssetSymbol(assetInfo) : '';
}

// @ts-ignore
function getOriginChain (assetInfo?: _ChainAsset) {
  return assetInfo ? _getAssetOriginChain(assetInfo) : '';
}

const Component = () => {
  const { t } = useTranslation();
  const { defaultData, setCustomScreenTitle } = useTransactionContext<SwapParams>();
  const { isWebUI } = useContext(ScreenContext);

  const { activeModal } = useContext(ModalContext);

  const { isAllAccount } = useSelector((state) => state.accountState);
  const assetRegistryMap = useSelector((state) => state.assetRegistry.assetRegistry);
  const swapPairs = useSelector((state) => state.swap.swapPairs);

  const [form] = Form.useForm<SwapParams>();
  const formDefault = useMemo((): SwapParams => ({ ...defaultData }), [defaultData]);

  const [quoteOptions, setQuoteOptions] = useState<SwapQuote[]>([]);
  const [currentQuote, setCurrentQuote] = useState<SwapQuote | undefined>(undefined);

  const [isViewFeeDetails, setIsViewFeeDetails] = useState<boolean>(false);

  const fromValue = useWatchTransaction('from', form, defaultData);
  const fromTokenSlugValue = useWatchTransaction('fromTokenSlug', form, defaultData);
  const toTokenSlugValue = useWatchTransaction('toTokenSlug', form, defaultData);

  const fromAndToTokenMap = useMemo<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {};

    swapPairs.forEach((pair) => {
      if (!result[pair.from]) {
        result[pair.from] = [pair.to];
      } else {
        result[pair.from].push(pair.to);
      }
    });

    return result;
  }, [swapPairs]);

  const fromTokenItems = useMemo<TokenSelectorItemType[]>(() => {
    return getTokenSelectorItem(Object.keys(fromAndToTokenMap), assetRegistryMap);
  }, [assetRegistryMap, fromAndToTokenMap]);

  const toTokenItems = useMemo<TokenSelectorItemType[]>(() => {
    return getTokenSelectorItem(fromAndToTokenMap[fromTokenSlugValue] || [], assetRegistryMap);
  }, [assetRegistryMap, fromAndToTokenMap, fromTokenSlugValue]);

  const isSwitchable = useMemo(() => {
    return fromAndToTokenMap[toTokenSlugValue];
  }, [fromAndToTokenMap, toTokenSlugValue]);

  // todo: fill later
  const destChain = '';
  const destChainNetworkPrefix = 42;
  const destChainGenesisHash = '';

  const fromAssetInfo = useMemo(() => {
    return assetRegistryMap[fromTokenSlugValue] || undefined;
  }, [assetRegistryMap, fromTokenSlugValue]);

  const toAssetInfo = useMemo(() => {
    return assetRegistryMap[toTokenSlugValue] || undefined;
  }, [assetRegistryMap, toTokenSlugValue]);

  const recipientAddressValidator = useCallback((rule: Rule, _recipientAddress: string): Promise<void> => {
    if (!_recipientAddress) {
      return Promise.reject(t('Recipient address is required'));
    }

    if (!isAddress(_recipientAddress)) {
      return Promise.reject(t('Invalid recipient address'));
    }

    return Promise.resolve();
  }, [t]);

  const onSelectFromToken = useCallback((tokenSlug: string) => {
    form.setFieldValue('fromTokenSlug', tokenSlug);
  }, [form]);

  const onSelectToToken = useCallback((tokenSlug: string) => {
    form.setFieldValue('toTokenSlug', tokenSlug);
  }, [form]);

  const onSubmit: FormCallbacks<SwapParams>['onFinish'] = useCallback((values: SwapParams) => {
    //
  }, []);

  const onOpenSlippageModal = useCallback(() => {
    activeModal(SWAP_SLIPPAGE_MODAL);
  }, [activeModal]);

  const openAllQuotesModal = useCallback(() => {
    activeModal(SWAP_ALL_QUOTES_MODAL);
  }, [activeModal]);

  const openChooseFeeToken = useCallback(() => {
    activeModal(SWAP_CHOOSE_FEE_TOKEN_MODAL);
  }, [activeModal]);

  const onSelectQuote = useCallback((quote: SwapQuote) => {
    setCurrentQuote(quote);
  }, []);

  const onToggleFeeDetails = useCallback(() => {
    setIsViewFeeDetails((prev) => !prev);
  }, []);

  useEffect(() => {
    let sync = true;

    handleSwapRequest({
      address: '15MLn9YQaHZ4GMkhK3qXqR5iGGSdULyJ995ctjeBgFRseyi6',
      pair: swapPairs[0],
      fromAmount: '40000000000',
      slippage: 0.05
    }).then((result) => {
      if (sync) {
        if (result.quote) {
          setQuoteOptions(result.quote.quotes);
          setCurrentQuote(result.quote.optimalQuote);
        } else {
          setCurrentQuote(undefined);
        }
      }
    }).catch(console.error);

    return () => {
      sync = false;
    };
  }, [swapPairs]);

  useEffect(() => {
    setCustomScreenTitle(t('Swap'));

    return () => {
      setCustomScreenTitle(undefined);
    };
  }, [setCustomScreenTitle, t]);

  useEffect(() => {
    if (!fromTokenSlugValue && fromTokenItems.length) {
      form.setFieldValue('fromTokenSlug', fromTokenItems[0].slug);
    }
  }, [form, fromTokenItems, fromTokenSlugValue]);

  useEffect(() => {
    if (!toTokenSlugValue && toTokenItems.length) {
      form.setFieldValue('toTokenSlug', toTokenItems[0].slug);
    }
  }, [form, toTokenItems, toTokenSlugValue]);

  const renderRateInfo = () => {
    if (!currentQuote) {
      return null;
    }

    return (
      <div className={'__quote-estimate-swap-value'}>
        <Number
          decimal={0}
          suffix={getSymbol(fromAssetInfo)}
          value={1}
        />
        <span>~</span>
        <Number
          decimal={0}
          suffix={getSymbol(toAssetInfo)}
          value={1 / currentQuote.rate}
        />
      </div>
    );
  };

  return (
    <>
      <>
        <div className={'__transaction-form-area'}>
          <TransactionContent>
            <Form
              className={'form-container'}
              form={form}
              initialValues={formDefault}
              onFinish={onSubmit}
            >
              <HiddenInput fields={hideFields} />

              <Form.Item
                name={'from'}
              >
                <AccountSelector
                  disabled={!isAllAccount}
                  label={t('Swap from account')}
                />
              </Form.Item>

              <div className={'__balance-display-area'}>
                <FreeBalance
                  address={fromValue}
                  chain={''}
                  isSubscribe={true}
                  label={`${t('Available balance')}:`}
                  tokenSlug={fromTokenSlugValue}
                />
              </div>

              <div className={'__swap-field-area'}>
                <SwapFromField
                  decimals={getDecimals(fromAssetInfo)}
                  label={t('From')}
                  onSelectToken={onSelectFromToken}
                  tokenSelectorItems={fromTokenItems}
                  tokenSelectorValue={fromTokenSlugValue}
                />

                <div className='__switch-side-button'>
                  <Button
                    disabled={!isSwitchable}
                    icon={(
                      <Icon
                        customSize={'20px'}
                        phosphorIcon={ArrowsDownUp}
                        weight='fill'
                      />
                    )}
                    shape='circle'
                    size='xs'
                  >
                  </Button>
                </div>

                <SwapToField
                  decimals={getDecimals(toAssetInfo)}
                  onSelectToken={onSelectToToken}
                  tokenSelectorItems={toTokenItems}
                  tokenSelectorValue={toTokenSlugValue}
                />
              </div>

              <Form.Item
                name={'recipient'}
                rules={[
                  {
                    validator: recipientAddressValidator
                  }
                ]}
                statusHelpAsTooltip={isWebUI}
                validateTrigger='onBlur'
              >
                <AddressInput
                  addressPrefix={destChainNetworkPrefix}
                  allowDomain={true}
                  chain={destChain}
                  label={t('Recipient account')}
                  networkGenesisHash={destChainGenesisHash}
                  placeholder={t('Input your recipient account')}
                  saveAddress={true}
                  showAddressBook={true}
                  showScanner={true}
                />
              </Form.Item>
            </Form>

            <div className={'__slippage-info'}>
              <span>Slippage:</span>
              &nbsp;<span>2%</span>
              <div
                className={'__slippage-editor-button'}
                onClick={onOpenSlippageModal}
              >
                <Icon
                  className={'__slippage-editor-button-icon'}
                  phosphorIcon={PencilSimpleLine}
                  size='sm'
                />
              </div>

            </div>
          </TransactionContent>
          <TransactionFooter>
            <Button
              block={true}
              className={'__swap-submit-button'}
              icon={(
                <Icon
                  phosphorIcon={PlusCircle}
                  weight={'fill'}
                />
              )}
              onClick={form.submit}
            >
              {t('Swap')}
            </Button>
          </TransactionFooter>
        </div>

        <div className={'__transaction-swap-quote-info-area'}>
          <div className={'__item-quote-header'}>
            <div className={'__item-left-part'}>
              <BackgroundIcon
                backgroundColor='#004BFF'
                iconColor='#fff'
                phosphorIcon={Info}
                size={'md'}
                weight={'fill'}
              />
              <div className={'__text'}>Swap quote</div>
            </div>
            <div className={'__item-right-part'}>
              <div className={'__item-right-part-button'}>
                <Button
                  onClick={openAllQuotesModal}
                  size='xs'
                  type='ghost'
                >
                  <span className={'__item-right-title'}>
                    View quote
                  </span>
                  <Icon
                    phosphorIcon={CaretRight}
                    size={'sm'}
                  />
                </Button>
              </div>
            </div>
          </div>

          {
            !!currentQuote && (
              <MetaInfo
                className={CN('__quote-info-block')}
                hasBackgroundWrapper
                labelColorScheme={'gray'}
                spaceSize={'sm'}
                valueColorScheme={'gray'}
              >
                <MetaInfo.Default
                  className={'__quote-rate'}
                  label={t('Quote rate')}
                  valueColorSchema={'gray'}
                >
                  {renderRateInfo()}
                </MetaInfo.Default>

                <MetaInfo.Default
                  label={t('Swap provider')}
                >
                  {currentQuote.provider.name}
                </MetaInfo.Default>

                <MetaInfo.Default
                  className={'-d-column'}
                  label={t('Swap route')}
                >
                </MetaInfo.Default>
                <SwapRoute swapRoute={currentQuote.route} />
              </MetaInfo>
            )
          }

          <div className={'__item-footer-time'}>
            Quote reset in: 2s
          </div>

          {
            !!currentQuote && (
              <MetaInfo
                className={CN('__quote-info-block')}
                hasBackgroundWrapper
                labelColorScheme={'gray'}
                spaceSize={'xs'}
                valueColorScheme={'gray'}
              >
                <MetaInfo.Number
                  decimals={0}
                  label={t('Estimated fee')}
                  onClickValue={onToggleFeeDetails}
                  prefix={'$'}
                  suffixNode={
                    <Icon
                      customSize={'20px'}
                      phosphorIcon={isViewFeeDetails ? CaretUp : CaretDown}
                    />
                  }
                  value={0.03}
                />

                {
                  isViewFeeDetails && (
                    <div className={'__quote-fee-details-block'}>
                      <MetaInfo.Number
                        decimals={0}
                        label={t('Network fee')}
                        prefix={'$'}
                        value={0.01}
                      />
                      <MetaInfo.Number
                        decimals={0}
                        label={t('Protocol fee')}
                        prefix={'$'}
                        value={0.02}
                      />
                    </div>
                  )
                }

                <div className={'__separator'}></div>
                <MetaInfo.Chain
                  chain={'kusama'}
                  className='__item-fee-paid'
                  label={t('Fee paid in')}
                  onClickValue={openChooseFeeToken}
                  suffixNode={
                    <Icon
                      customSize={'20px'}
                      phosphorIcon={PencilSimpleLine}
                    />
                  }
                />
              </MetaInfo>
            )
          }
        </div>
      </>

      <ChooseFeeTokenModal
        modalId={SWAP_CHOOSE_FEE_TOKEN_MODAL}
      />
      <SlippageModal
        modalId={SWAP_SLIPPAGE_MODAL}
      />
      <AddMoreBalanceModal
        modalId={SWAP_MORE_BALANCE_MODAL}
      />
      <AllSwapQuotes
        items={quoteOptions}
        modalId={SWAP_ALL_QUOTES_MODAL}
        onSelectItem={onSelectQuote}
        selectedItem={currentQuote}
      />
    </>
  );
};

const Wrapper: React.FC<Props> = (props: Props) => {
  const { className } = props;
  const dataContext = useContext(DataContext);

  return (
    <PageWrapper
      className={CN(className)}
      resolve={dataContext.awaitStores(['swap'])}
    >
      <Component />
    </PageWrapper>
  );
};

const Swap = styled(Wrapper)<Props>(({ theme: { token } }: Props) => {
  return {
    display: 'flex',
    flexDirection: 'row',
    paddingTop: 24,
    maxWidth: 784,
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    gap: token.size,
    '.__swap-field-area': {
      position: 'relative'
    },
    '.__item-right-title': {
      color: token.colorTextTertiary
    },

    '.__slippage-info': {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      color: token.colorSuccess,
      cursor: 'pointer',
      marginBottom: 24
    },
    '.__item-footer-time': {
      color: token.colorWarningText,
      display: 'flex',
      justifyContent: 'flex-end',
      paddingLeft: 8,
      paddingRight: 8,
      marginBottom: 12
    },

    // swap quote

    '.__transaction-swap-quote-info-area': {

    },
    '.__quote-estimate-swap-value': {
      display: 'flex'
    },

    '.__quote-info-block': {

    },

    '.__quote-fee-details-block': {
      paddingLeft: token.paddingXS
    },

    '.__separator': {
      height: 2,
      opacity: 0.8,
      backgroundColor: token.colorBgBorder
    },

    '.__item-quote-header': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    '.__item-left-part': {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    },
    '.__item-right-part': {
      display: 'flex',
      alignItems: 'center'
    },

    // desktop

    '.web-ui-enable &': {
      '.__transaction-form-area': {
        flex: '1'
      },

      '.__transaction-swap-quote-info-area': {
        flex: '1'
      }
    },
    '.__switch-side-button': {
      display: 'flex',
      justifyContent: 'center',
      position: 'absolute',
      alignItems: 'center',
      width: '100%',
      top: '46%'
    }
  };
});

export default Swap;
