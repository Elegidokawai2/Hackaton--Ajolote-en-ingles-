'use client';

import { Toaster } from 'sileo';

export default function ToasterProvider() {
  return <Toaster
    options={{
      fill: "#171717",
      styles: { description: "text-white" },
    }}
    position="bottom-right" />;
}
