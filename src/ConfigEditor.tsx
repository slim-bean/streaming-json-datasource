import React from "react";
import { DataSourcePluginOptionsEditorProps } from "@grafana/data";
import { LiveDataSourceOptions } from "./types";
import { DataSourceHttpSettings } from "@grafana/ui";

interface Props
  extends DataSourcePluginOptionsEditorProps<LiveDataSourceOptions> {}

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={"..."}
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
      />
    </>
  );
};
