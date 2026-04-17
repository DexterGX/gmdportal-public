"use client";

import { useEffect } from "react";

interface PrintQuoteLayoutProps {
  autoPrint?: boolean;
  company: {
    logoUrl: string;
    companyName: string;
    phoneNumber?: string;
    address?: string;
  };
  job: {
    quoteNumber: string;
    propertyAddress: string;
    areaLabel: string;
    customerName?: string;
    salesPersonName?: string;
    salesPersonEmail?: string;
    createdAt: string;
    approvedAt?: string | null;
  };
  quote: {
    quoteCode: string;
    color: string;
    finalPriceFormatted: string;
  };
  files: Array<{
    fileUrl: string;
    caption?: string | null;
  }>;
}

export default function PrintQuoteLayout({
  autoPrint = false,
  company,
  job,
  quote,
  files,
}: PrintQuoteLayoutProps) {
  useEffect(() => {
    if (autoPrint) {
      // Small delay to ensure page is fully rendered
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const displayDate = job.approvedAt
    ? new Date(job.approvedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date(job.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  return (
    <div className="min-h-screen w-full bg-white text-black p-8 print:p-6 quote-print-layout">
      {/* Print Button (visible only on screen) */}
      <div className="print:hidden mb-4 flex justify-end gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Print Quote
        </button>
      </div>

      <div className="max-w-4xl mx-auto print:max-w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-300 print:mb-4 print:pb-4">
          {/* Left: Company Logo and Info */}
          <div className="flex-1">
            <div className="mb-3 print:mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={company.logoUrl}
                alt={`${company.companyName} logo`}
                className="w-32 h-16 object-contain print:w-24 print:h-12"
              />
            </div>
            <div className="text-sm space-y-1 print:space-y-0">
              <p className="font-bold text-lg print:text-base">{company.companyName}</p>
              {company.address && <p className="print:text-xs">{company.address}</p>}
              {company.phoneNumber && (
                <p className="print:text-xs">Phone: {company.phoneNumber}</p>
              )}
            </div>
          </div>

          {/* Right: Quote Info */}
          <div className="text-right">
            <h1 className="text-2xl font-bold mb-2 print:text-xl print:mb-1">
              Closet Design & Installation Quote
            </h1>
            <div className="text-sm space-y-1 print:text-xs print:space-y-0">
              <p className="font-semibold">
                Quote #: {job.quoteNumber} / {quote.quoteCode}
              </p>
              <p>Date: {displayDate}</p>
            </div>
          </div>
        </div>

        {/* Project Information */}
        <div className="mb-8 print:mb-4">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2 print:text-lg print:mb-2 print:pb-1">
            Project Information
          </h2>
          <div className="grid grid-cols-2 gap-4 print:gap-2">
            {job.customerName && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide print:text-[8pt]">
                  Client
                </p>
                <p className="font-semibold print:text-sm">
                  {job.customerName}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide print:text-[8pt]">
                Property Address
              </p>
              <p className="font-semibold print:text-sm">
                {job.propertyAddress}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide print:text-[8pt]">
                Area
              </p>
              <p className="font-semibold print:text-sm">{job.areaLabel}</p>
            </div>
            {job.salesPersonName && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide print:text-[8pt]">
                  Salesperson
                </p>
                <p className="font-semibold print:text-sm">
                  {job.salesPersonName}
                </p>
                {job.salesPersonEmail && (
                  <p className="text-xs text-gray-600 print:text-[8pt]">
                    {job.salesPersonEmail}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Overview */}
        <div className="mb-8 print:mb-4">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2 print:text-lg print:mb-2 print:pb-1">
            Project Overview
          </h2>
          <p className="text-gray-700 leading-relaxed print:text-sm print:leading-normal">
            Custom closet system for the {job.areaLabel.toLowerCase()} at{" "}
            {job.propertyAddress}, including design, materials, and professional
            installation as illustrated in the 3D views below. This{" "}
            {quote.color} finish closet system is designed to maximize storage
            space and provide elegant organization solutions tailored to your
            specific needs.
          </p>
        </div>

        {/* Investment */}
        <div className="mb-8 print:mb-4">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2 print:text-lg print:mb-2 print:pb-1">
            Investment
          </h2>
          <div className="bg-gray-50 p-6 rounded-lg print:p-4 print:rounded-none print:border print:border-gray-300 print-bg">
            <p className="text-lg mb-2 print:text-base print:mb-1">
              Total investment for this closet design and installation:
            </p>
            <p className="text-4xl font-bold text-green-600 print:text-3xl print:text-black">
              {quote.finalPriceFormatted}
            </p>
            <p className="text-sm text-gray-600 mt-3 print:text-xs print:mt-2">
              This quote is valid for 30 days from the date above. Price
              includes design, materials, and professional installation.
            </p>
          </div>
        </div>

        {/* 3D Views */}
        {files.length > 0 && (
          <div className="mb-8 print:mb-4">
            <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2 print:text-lg print:mb-2 print:pb-1">
              Design Visualization
            </h2>
            <div className="grid grid-cols-2 gap-4 print:gap-3">
              {files.map((file, index) => (
                <figure
                  key={index}
                  className="text-center print:break-inside-avoid"
                >
                  <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 print:h-[180px] print:w-full print:bg-white print:rounded-none print:border-gray-400">
                    <img
                      src={file.fileUrl}
                      alt={file.caption || `Design view ${index + 1}`}
                      className="max-w-full max-h-full object-contain print:max-w-full print:max-h-full"
                    />
                  </div>
                  {file.caption && (
                    <figcaption className="text-xs text-gray-600 mt-2 print:mt-1 print:text-[8pt]">
                      {file.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-300 text-center text-sm text-gray-600 print:mt-6 print:pt-3 print:text-xs">
          <p>
            Thank you for considering {company.companyName} for your closet
            project!
          </p>
          <p className="mt-2 print:mt-1">
            For questions or to proceed with this quote, please contact your
            salesperson.
          </p>
        </div>
      </div>
    </div>
  );
}
