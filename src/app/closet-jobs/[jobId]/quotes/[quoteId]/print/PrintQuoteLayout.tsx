"use client";

import { useEffect } from "react";

interface PrintQuoteLayoutProps {
  autoPrint?: boolean;
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
    <div className="min-h-screen w-full bg-white text-black p-8 print:p-4">
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

      {/* Print Button (visible only on screen) */}
      <div className="no-print mb-4 flex justify-end">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Print Quote
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-300">
          {/* Left: Company Logo and Info */}
          <div className="flex-1">
            <div className="mb-3">
              {/* Replace with actual logo path */}
              <div className="w-32 h-16 bg-gray-200 flex items-center justify-center rounded">
                <span className="text-xs text-gray-600">GM Design Logo</span>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <p className="font-bold text-lg">GM Design</p>
              <p>Custom Closets & Cabinetry</p>
              <p>Miami, FL</p>
              <p>Phone: (305) XXX-XXXX</p>
            </div>
          </div>

          {/* Right: Quote Info */}
          <div className="text-right">
            <h1 className="text-2xl font-bold mb-2">
              Closet Design & Installation Quote
            </h1>
            <div className="text-sm space-y-1">
              <p className="font-semibold">
                Quote #: {job.quoteNumber} / {quote.quoteCode}
              </p>
              <p>Date: {displayDate}</p>
            </div>
          </div>
        </div>

        {/* Project Information */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2">
            Project Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {job.customerName && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">
                  Client
                </p>
                <p className="font-semibold">{job.customerName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                Property Address
              </p>
              <p className="font-semibold">{job.propertyAddress}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                Area
              </p>
              <p className="font-semibold">{job.areaLabel}</p>
            </div>
            {job.salesPersonName && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">
                  Salesperson
                </p>
                <p className="font-semibold">{job.salesPersonName}</p>
                {job.salesPersonEmail && (
                  <p className="text-xs text-gray-600">
                    {job.salesPersonEmail}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2">
            Project Overview
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Custom closet system for the {job.areaLabel.toLowerCase()} at{" "}
            {job.propertyAddress}, including design, materials, and professional
            installation as illustrated in the 3D views below. This{" "}
            {quote.color} finish closet system is designed to maximize storage
            space and provide elegant organization solutions tailored to your
            specific needs.
          </p>
        </div>

        {/* 3D Views */}
        {files.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2">
              Design Visualization
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {files.map((file, index) => (
                <figure key={index} className="text-center">
                  <img
                    src={file.fileUrl}
                    alt={file.caption || `Design view ${index + 1}`}
                    className="w-full h-64 object-cover rounded-lg border border-gray-200"
                  />
                  {file.caption && (
                    <figcaption className="text-xs text-gray-600 mt-2">
                      {file.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* Investment */}
        <div className="mb-8 mt-12 pt-6 border-t-2 border-gray-300">
          <h2 className="text-xl font-bold mb-4">Investment</h2>
          <div className="bg-gray-50 p-6 rounded-lg">
            <p className="text-lg mb-2">
              Total investment for this closet design and installation:
            </p>
            <p className="text-4xl font-bold text-green-600">
              {quote.finalPriceFormatted}
            </p>
            <p className="text-sm text-gray-600 mt-3">
              This quote is valid for 30 days from the date above. Price
              includes design, materials, and professional installation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-300 text-center text-sm text-gray-600">
          <p>Thank you for considering GM Design for your closet project!</p>
          <p className="mt-2">
            For questions or to proceed with this quote, please contact your
            salesperson.
          </p>
        </div>
      </div>
    </div>
  );
}
