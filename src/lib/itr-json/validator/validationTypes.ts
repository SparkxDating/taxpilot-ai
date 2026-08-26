export type OfficialSchemaError = {
  path: string;
  field: string;
  keyword: string;
  message: string;
  explanation: string;
};

export type OfficialValidationResult = {
  valid: boolean;
  errors: OfficialSchemaError[];
  warnings: OfficialSchemaError[];
  schemaVersion: string;
  schemaMode: "OfficialSchema" | "DevelopmentSchema";
};
