// @ts-nocheck
"use client";
import React from "react";

export function AiVerificationBadge({ result }: { result: any }) {
  if (!result) return null;

  const isHuman = result.human_confidence_score >= 70 && result.is_verified_human;

  return (
    <div
      className={`mt-4 rounded-xl border p-4 text-sm ${
        isHuman
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-red-300 bg-red-50 text-red-900"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-base">
          {isHuman ? "Human made" : "AI"} ({result.human_confidence_score}% Human)
        </span>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
            isHuman ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {isHuman ? "Verified >= 70%" : "Blocked < 70%"}
        </span>
      </div>

      {result.detection_breakdown && result.detection_breakdown.length > 0 && (
        <ul className="mt-2 list-disc pl-5 space-y-1 text-xs opacity-90">
          {result.detection_breakdown.map((reason: string, idx: number) => (
            <li key={idx}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}