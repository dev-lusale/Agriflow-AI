"use client";

import * as React from "react";
import { DISTRICTS, PROVINCES } from "@/lib/zambia";
import { SelectField } from "./action-form";

/** Linked Province → District selectors (Zambia). */
export function LocationFields({
  provinceName = "province",
  districtName = "district",
  defaultProvince,
  defaultDistrict,
  labels = { province: "Province", district: "District" },
  required = true,
}: {
  provinceName?: string;
  districtName?: string;
  defaultProvince?: string | null;
  defaultDistrict?: string | null;
  labels?: { province: string; district: string };
  required?: boolean;
}) {
  const [province, setProvince] = React.useState(defaultProvince ?? "");
  const districts = province ? DISTRICTS[province as keyof typeof DISTRICTS] ?? [] : [];
  return (
    <>
      <SelectField
        name={provinceName}
        label={labels.province}
        required={required}
        value={province}
        onChange={(e) => setProvince(e.target.value)}
        placeholder="Select province"
        options={PROVINCES.map((p) => ({ value: p.value, label: p.label }))}
      />
      <SelectField
        key={province}
        name={districtName}
        label={labels.district}
        required={required}
        defaultValue={province === defaultProvince ? (defaultDistrict ?? "") : ""}
        disabled={!province}
        placeholder={province ? "Select district" : "Select a province first"}
        options={districts.map((d) => ({ value: d.name, label: d.name }))}
      />
    </>
  );
}
