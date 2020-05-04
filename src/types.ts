import { DataQuery, DataSourceJsonData } from '@grafana/data';

export enum LiveQueryType {
  OpenStreams = 'openStreamInfo',
  AvaliableStreams = 'avaliableStreams',
  Telegraph = 'telegraph',
  JSON = 'json',
}

export interface LiveQuery extends DataQuery {
  queryType: LiveQueryType;
  stream?: string;
  buffer: number;
}

export const defaultQuery: Partial<LiveQuery> = {
  buffer: 2000,
};

/**
 * These are options configured for each DataSource instance
 */
export interface LiveDataSourceOptions extends DataSourceJsonData {}
