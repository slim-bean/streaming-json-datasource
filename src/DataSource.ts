import { merge, Observable, Subject, of } from 'rxjs';
import { getTemplateSrv } from '@grafana/runtime';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  KeyValue,
  LoadingState,
  ArrayDataFrame,
  FieldType,
  CircularDataFrame,
} from '@grafana/data';

import { LiveQuery, LiveDataSourceOptions } from './types';

export class DataSource extends DataSourceApi<LiveQuery, LiveDataSourceOptions> {
  private url: string;
  private streams: KeyValue<StreamHandler> = {};
  templateSrv: any;

  constructor(instanceSettings: DataSourceInstanceSettings<LiveDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.url || '';
    this.templateSrv = getTemplateSrv();
  }

  query(options: DataQueryRequest<LiveQuery>): Observable<DataQueryResponse> {
    const res: Array<Observable<DataQueryResponse>> = [];

    // Return a constant for each query.
    for (const target of options.targets) {
      const url = this.url + this.templateSrv.replace(target.stream) || ''; // maybe plus stream
      let stream = this.streams[url];
      if (!stream) {
        stream = this.streams[url] = new StreamHandler(url, target);
      }
      if (!stream.isOpen) {
        stream.open();
      }
      res.push(stream.subject);
    }

    return merge(...res);
  }

  getOpenStreamInfo(): Observable<DataQueryResponse> {
    const info: StreamInfo[] = Object.values(this.streams).map(s => s.getInfo());
    const frame = new ArrayDataFrame(info);
    frame.setFieldType('opened', FieldType.time);
    frame.setFieldType('lastMessage', FieldType.time);
    return of({
      state: LoadingState.Done,
      data: [frame],
    });
  }

  getAvaliableStreams(): Observable<DataQueryResponse> {
    const info: StreamInfo[] = Object.values(this.streams).map(s => s.getInfo());
    const frame = new ArrayDataFrame(info);
    frame.setFieldType('opened', FieldType.time);
    frame.setFieldType('lastMessage', FieldType.time);
    return of({
      state: LoadingState.Done,
      data: [frame],
    });
  }

  async testDatasource() {
    return {
      status: 'success',
      message: 'Success',
    };
  }
}

interface StreamInfo {
  stream: string;
  opened: number;
  lastMessage: number;
  chunks: number;
  observers: number;
}

// We return a StreamHandler wrapped in a promise from the datasource's
// Query method. Grafana expects this object to have a `subscribe` method,
// which it reads live data from.
export class StreamHandler {
  subject = new Subject<DataQueryResponse>();
  info: StreamInfo;
  isOpen: boolean;
  reader?: ReadableStreamReader<Uint8Array>;
  data: KeyValue<CircularDataFrame> = {};

  constructor(private url: string, private query: LiveQuery) {
    this.info = {
      stream: query.stream || 'stream',
      opened: Date.now(),
      lastMessage: (undefined as unknown) as number,
      chunks: 0,
      observers: 0,
    };
    this.isOpen = false;
  }

  getInfo() {
    return {
      ...this.info,
      observers: this.subject.observers.length,
    };
  }

  open() {
    fetch(new Request(this.url)).then(response => {
      if (response.body) {
        this.reader = response.body.getReader();
        this.reader.read().then(this.processChunk);
      }
    });
    this.isOpen = true;
  }

  processMsg(msg: any) {
    const name = msg.name as string;
    let df = this.data[name];
    if (!df) {
      df = new CircularDataFrame({
        append: 'tail',
        capacity: this.query.buffer,
      });
      df.name = name;
      df.addField({ name: 'timestamp', type: FieldType.time }, 0);
      df.addField({ name: 'value', type: FieldType.number });
      this.data[name] = df;
    }

    const row = {
      timestamp: msg.ts,
      value: msg.val,
    };

    df.add(row, true);
  }

  processChunk = (value: ReadableStreamReadResult<Uint8Array>): any => {
    this.info.chunks++;
    if (value.value) {
      this.info.lastMessage = Date.now();
      const text = new TextDecoder().decode(value.value);
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          this.processMsg(msg);
        } catch (err) {
          //console.log( 'ERR', err);
        }
      }
    }

    this.subject.next({
      data: Object.values(this.data),
      key: this.info.stream,
      state: value.done ? LoadingState.Done : LoadingState.Streaming,
    });

    if (value.done) {
      this.isOpen = false;
      this.reader = undefined;
      console.log('Finished stream');
      this.subject.complete(); // necessary?
      return;
    }

    return this.reader!.read().then(this.processChunk);
  };

  handleMessage(msg: any) {
    console.log('MSG', msg);
  }

  close() {
    if (this.reader) {
      this.reader.cancel();
      this.reader = undefined;
    }
    this.isOpen = false;
  }
}

// export function runFetchStream(
//   query: LiveQuery,
//   req: DataQueryRequest<LiveQuery>
// ): Observable<DataQueryResponse> {
//   return new Observable<DataQueryResponse>(subscriber => {
//     const streamId = `fetch-${req.panelId}-${query.refId}`;
//     const maxDataPoints = req.maxDataPoints || 1000;

//     let data = new CircularDataFrame({
//       append: 'tail',
//       capacity: query.buffer,
//     });
//     data.refId = query.refId;
//     data.name = query.path; //query.alias || 'Fetch ' + query.refId;

//     let reader: ReadableStreamReader<Uint8Array>;
//     const csv = new CSVReader({
//       callback: {
//         onHeader: (fields: Field[]) => {
//           // Clear any existing fields
//           if (data.fields.length) {
//             data = new CircularDataFrame({
//               append: 'tail',
//               capacity: maxDataPoints,
//             });
//             data.refId = target.refId;
//             data.name = 'Fetch ' + target.refId;
//           }
//           for (const field of fields) {
//             data.addField(field);
//           }
//         },
//         onRow: (row: any[]) => {
//           data.add(row);
//         },
//       },
//     });

//     const processChunk = (value: ReadableStreamReadResult<Uint8Array>): any => {
//       if (value.value) {
//         const text = new TextDecoder().decode(value.value);
//         csv.readCSV(text);
//       }

//       subscriber.next({
//         data: [data],
//         key: streamId,
//         state: value.done ? LoadingState.Done : LoadingState.Streaming,
//       });

//       if (value.done) {
//         console.log('Finished stream');
//         subscriber.complete(); // necessary?
//         return;
//       }

//       return reader.read().then(processChunk);
//     };

//     if (!query.url) {
//       throw new Error('query.url is not defined');
//     }

//     fetch(new Request(query.url)).then(response => {
//       if (response.body) {
//         reader = response.body.getReader();
//         reader.read().then(processChunk);
//       }
//     });

//     return () => {
//       // Cancel fetch?
//       console.log('unsubscribing to stream ' + streamId);
//     };
//   });
// }
