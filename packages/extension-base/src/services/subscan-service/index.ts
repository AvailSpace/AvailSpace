// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { SWError } from '@subwallet/extension-base/background/errors/SWError';
import { CrowdloanContributionsResponse, ExtrinsicItem, ExtrinsicsListResponse, IMultiChainBalance, SubscanRequest, SubscanResponse, TransferItem, TransfersListResponse } from '@subwallet/extension-base/services/subscan-service/types';
import fetch from 'cross-fetch';

const QUERY_ROW = 100;

export class SubscanService {
  private limitRate = 2; // limit per interval check
  private intervalCheck = 1000; // interval check in ms
  private maxRetry = 9; // interval check in ms
  private requestMap: Record<number, SubscanRequest<any>> = {};
  private nextId = 0;
  private isRunning = false;
  private getId () {
    return this.nextId++;
  }

  constructor (private subscanChainMap: Record<string, string>, options?: {limitRate?: number, intervalCheck?: number, maxRetry?: number}) {
    this.limitRate = options?.limitRate || this.limitRate;
    this.intervalCheck = options?.intervalCheck || this.intervalCheck;
    this.maxRetry = options?.maxRetry || this.maxRetry;
  }

  private getApiUrl (chain: string, path: string) {
    const subscanChain = this.subscanChainMap[chain];

    if (!subscanChain) {
      throw new SWError('NOT_SUPPORTED', 'Chain is not supported');
    }

    return `https://${chain}.api.subscan.io/${path}`;
  }

  private postRequest (url: string, body: any) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  private addRequest<T> (run: SubscanRequest<T>['run']) {
    const newId = this.getId();

    return new Promise<T>((resolve, reject) => {
      this.requestMap[newId] = {
        id: newId,
        status: 'pending',
        retry: -1,
        run,
        resolve,
        reject
      };

      if (!this.isRunning) {
        this.process();
      }
    });
  }

  private process () {
    this.isRunning = true;
    const maxRetry = this.maxRetry;

    const interval = setInterval(() => {
      const remainingRequests = Object.values(this.requestMap);

      if (remainingRequests.length === 0) {
        this.isRunning = false;
        clearInterval(interval);

        return;
      }

      // Get first this.limit requests base on id
      const requests = remainingRequests
        .filter((request) => request.status !== 'running')
        .sort((a, b) => a.id - b.id)
        .slice(0, this.limitRate);

      // Start requests
      requests.forEach((request) => {
        request.status = 'running';
        request.run().then((rs) => {
          request.resolve(rs);
        }).catch((e) => {
          if (request.retry < maxRetry) {
            request.status = 'pending';
            request.retry++;
          } else {
            // Reject request
            request.reject(new SWError('MAX_RETRY', String(e)));
          }
        });
      });
    }, this.intervalCheck);
  }

  public checkSupportedSubscanChain (chain: string): boolean {
    return !!this.subscanChainMap[chain];
  }

  public setSubscanChainMap (subscanChainMap: Record<string, string>) {
    this.subscanChainMap = subscanChainMap;
  }

  // Implement Subscan API
  public getMultiChainBalance (address: string): Promise<IMultiChainBalance[]> {
    return this.addRequest(async () => {
      const rs = await this.postRequest(this.getApiUrl('polkadot', 'api/scan/multiChain/account'), { address });

      if (rs.status !== 200) {
        throw new SWError('SubscanService.getMultiChainBalance', await rs.text());
      }

      const jsonData = (await rs.json()) as SubscanResponse<IMultiChainBalance[]>;

      return jsonData.data;
    });
  }

  public getCrowdloanContributions (relayChain: string, address: string, page = 0): Promise<CrowdloanContributionsResponse> {
    return this.addRequest<CrowdloanContributionsResponse>(async () => {
      const rs = await this.postRequest(this.getApiUrl(relayChain, 'api/scan/account/contributions'), {
        include_total: true,
        page,
        row: QUERY_ROW,
        who: address
      });

      if (rs.status !== 200) {
        throw new SWError('SubscanService.getCrowdloanContributions', await rs.text());
      }

      const jsonData = (await rs.json()) as SubscanResponse<CrowdloanContributionsResponse>;

      return jsonData.data;
    });
  }

  public getExtrinsicsList (chain: string, address: string, page = 0): Promise<ExtrinsicsListResponse> {
    return this.addRequest<ExtrinsicsListResponse>(async () => {
      const rs = await this.postRequest(this.getApiUrl(chain, 'api/scan/extrinsics'), {
        page,
        row: QUERY_ROW,
        address
      });

      if (rs.status !== 200) {
        throw new SWError('SubscanService.getExtrinsicsList', await rs.text());
      }

      const jsonData = (await rs.json()) as SubscanResponse<ExtrinsicsListResponse>;

      return jsonData.data;
    });
  }

  public async getAllExtrinsicItems (chain: string, address: string): Promise<ExtrinsicItem[]> {
    let currentPage = 0;
    const result: ExtrinsicItem[] = [];

    while (true) {
      try {
        const res = await this.getExtrinsicsList(chain, address, currentPage);

        if (res.extrinsics) {
          result.push(...res.extrinsics);
          ++currentPage;

          if (result.length >= res.count) {
            break;
          }
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }

    return result;
  }

  public getTransfersList (chain: string, address: string, page = 0): Promise<TransfersListResponse> {
    return this.addRequest<TransfersListResponse>(async () => {
      const rs = await this.postRequest(this.getApiUrl(chain, 'api/v2/scan/transfers'), {
        page,
        row: QUERY_ROW,
        address
      });

      if (rs.status !== 200) {
        throw new SWError('SubscanService.getTransfersList', await rs.text());
      }

      const jsonData = (await rs.json()) as SubscanResponse<TransfersListResponse>;

      return jsonData.data;
    });
  }

  public async getAllTransferItems (chain: string, address: string): Promise<TransferItem[]> {
    let currentPage = 0;
    const result: TransferItem[] = [];

    while (true) {
      try {
        const res = await this.getTransfersList(chain, address, currentPage);

        if (res.transfers) {
          result.push(...res.transfers);
          ++currentPage;

          if (result.length >= res.count) {
            break;
          }
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }

    return result;
  }
}
