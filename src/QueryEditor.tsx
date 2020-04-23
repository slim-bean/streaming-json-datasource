import defaults from "lodash/defaults";

import React, { PureComponent, ChangeEvent } from "react";
import { QueryEditorProps } from "@grafana/data";
import { DataSource } from "./DataSource";
import { LiveQuery, LiveDataSourceOptions, defaultQuery } from "./types";
import { LegacyForms } from "@grafana/ui";

type Props = QueryEditorProps<DataSource, LiveQuery, LiveDataSourceOptions>;

interface State {}

export class QueryEditor extends PureComponent<Props, State> {
  onComponentDidMount() {}

  onStreamChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, stream: event.target.value });
  };

  onBufferChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, buffer: parseInt(event.target.value, 10) });
    onRunQuery(); // executes the query
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { stream, buffer } = query;

    return (
      <div className="gf-form">
        <LegacyForms.FormField
          width={4}
          value={buffer}
          onChange={this.onBufferChange}
          label="Constant"
          type="number"
          step={10}
        ></LegacyForms.FormField>
        <LegacyForms.FormField
          labelWidth={8}
          value={stream || ""}
          onChange={this.onStreamChange}
          label="Query Path"
          tooltip="from the base url"
        ></LegacyForms.FormField>
      </div>
    );
  }
}
