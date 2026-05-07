"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import type { Section, TaxForm, MappingData } from "@/lib/types";
import SectionCard from "./SectionCard";
import FormCard from "./FormCard";
import CategoryFilter from "./CategoryFilter";
import Fuse from "fuse.js";

type Tab = "sections" | "forms";

interface SearchInterfaceProps {
  data: MappingData;
}

export function SearchInterface({ data }: SearchInterfaceProps) {
  const [tab, setTab] = useState<Tab>("sections");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [, startTransition] = useTransition();

  // Build Fuse indexes client-side
  const sectionFuse = useMemo(
    () =>
      new Fuse(data.sections, {
        keys: [
          { name: "old_ref", weight: 2.0 },
          { name: "new_ref", weight: 2.0 },
          { name: "old_title", weight: 1.5 },
          { name: "new_title", weight: 1.5 },
          { name: "keywords", weight: 1.2 },
          { name: "plain_english_summary", weight: 0.8 },
          { name: "category", weight: 0.5 },
        ],
        threshold: 0.35,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [data.sections]
  );

  const formFuse = useMemo(
    () =>
      new Fuse(data.forms, {
        keys: [
          { name: "old_form", weight: 2.0 },
          { name: "new_form", weight: 2.0 },
          { name: "old_purpose", weight: 1.5 },
          { name: "new_purpose", weight: 1.5 },
          { name: "keywords", weight: 1.2 },
          { name: "structural_changes", weight: 0.8 },
        ],
        threshold: 0.35,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [data.forms]
  );

  // Search results
  const sectionResults = useMemo((): Section[] => {
    let results = query.trim()
      ? sectionFuse.search(query).map((r) => r.item)
      : [...data.sections];
    if (category !== "All") results = results.filter((s) => s.category === category);
    return results;
  }, [query, category, sectionFuse, data.sections]);

  const formResults = useMemo((): TaxForm[] => {
    return query.trim()
      ? formFuse.search(query).map((r) => r.item)
      : [...data.forms];
  }, [query, formFuse, data.forms]);

  // Category counts (based on current query, ignoring active category)
  const categoryCounts = useMemo(() => {
    const base = query.trim()
      ? sectionFuse.search(query).map((r) => r.item)
      : [...data.sections];
    const counts: Record<string, number> = { All: base.length };
    for (const s of base) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [query, sectionFuse, data.sections]);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      startTransition(() => {
        setQuery(v);
        setCategory("All");
      });
    },
    []
  );

  const handleCategoryChange = useCallback((cat: string) => {
    startTransition(() => setCategory(cat));
  }, []);

  const activeResults = tab === "sections" ? sectionResults.length : formResults.length;
  const totalAvailable = tab === "sections" ? data.sections.length : data.forms.length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          {/* Top bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 24,
              paddingBottom: 20,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  TaxBridge
                </h1>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    background: "var(--saffron)",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                  }}
                >
                  BETA
                </span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  margin: "4px 0 0",
                }}
              >
                Income Tax Act 1961 → 2025 · Section & Form Mapper
              </p>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                background: "var(--bg)",
                padding: "6px 14px",
                borderRadius: 20,
                border: "1px solid var(--border)",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--moss)",
                  flexShrink: 0,
                }}
              />
              {data.meta.total_sections} sections · {data.meta.total_forms} forms · Tax Year 2026-27
            </div>
          </div>

          {/* Search box */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <svg
              style={{
                position: "absolute",
                left: 18,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                pointerEvents: "none",
              }}
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx={11} cy={11} r={8} />
              <line x1={21} y1={21} x2={16.65} y2={16.65} />
            </svg>
            <input
              className="search-input"
              type="text"
              value={query}
              onChange={handleSearch}
              placeholder='Search "80C", "194C", "Form 16", "TDS rent", "capital gains"…'
              autoFocus
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setCategory("All"); }}
                style={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 2,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {(["sections", "forms"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={tab === t ? "tab-active" : "tab-inactive"}
                style={{
                  background: "none",
                  border: "none",
                  padding: "10px 20px 10px 0",
                  fontSize: 14,
                  cursor: "pointer",
                  marginRight: 20,
                  lineHeight: 1,
                }}
              >
                {t === "sections" ? "Sections" : "TDS/TCS Forms"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 24px 60px" }}>
        {/* Category filter — sections only */}
        {tab === "sections" && (
          <div style={{ marginBottom: 20 }}>
            <CategoryFilter
              active={category}
              onChange={handleCategoryChange}
              counts={categoryCounts}
            />
          </div>
        )}

        {/* Result count */}
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>
            {query
              ? `${activeResults} result${activeResults !== 1 ? "s" : ""} for "${query}"`
              : `All ${totalAvailable} ${tab === "sections" ? "sections" : "forms"}`}
            {tab === "sections" && category !== "All" && ` · ${category}`}
          </span>
          {activeResults === 0 && query && (
            <span style={{ color: "var(--crimson)" }}>— try a keyword like "80C", "rent", or "TDS"</span>
          )}
        </div>

        {/* Results grid */}
        {tab === "sections" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sectionResults.length > 0 ? (
              sectionResults.slice(0, 50).map((section, i) => (
                <SectionCard key={section.id} section={section} index={i} totalSections={data.meta.total_sections} />
              ))
            ) : (
              <EmptyState query={query} tab={tab} />
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {formResults.length > 0 ? (
              formResults.map((form, i) => (
                <FormCard key={form.id} form={form} index={i} />
              ))
            ) : (
              <EmptyState query={query} tab={tab} />
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div
          style={{
            marginTop: 48,
            padding: "16px 20px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "var(--text-secondary)" }}>Disclaimer: </strong>
          {data.meta.disclaimer}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ query, tab }: { query: string; tab: Tab }) {
  const suggestions =
    tab === "sections"
      ? ["80C", "194C", "capital gains", "TDS rent", "87A", "standard deduction"]
      : ["Form 16", "24Q", "15G", "TCS return", "Form 3CD"];

  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
      <p style={{ fontSize: 15, marginBottom: 20 }}>
        No results for <strong style={{ color: "var(--text-secondary)" }}>&ldquo;{query}&rdquo;</strong>
      </p>
      <p style={{ fontSize: 13, marginBottom: 16 }}>Try one of these:</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {suggestions.map((s) => (
          <span
            key={s}
            style={{
              padding: "5px 14px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: 20,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
