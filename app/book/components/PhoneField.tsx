"use client";

import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function PhoneField({ value, onChange, disabled }: Props) {
  return (
    <PhoneInput
      defaultCountry="us"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="ss-phone-input"
    />
  );
}
