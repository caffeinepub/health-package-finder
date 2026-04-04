import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Activity,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Database,
  ExternalLink,
  FileCheck,
  FileText,
  FolderOpen,
  Globe,
  Home,
  Info,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClaimsModule } from "./components/ClaimsModule";
import { ClinicalDocsModule } from "./components/ClinicalDocsModule";
import { GenerateNotesModal } from "./components/GenerateNotesModal";
import type { HealthPackage } from "./components/GenerateNotesModal";
import { LocalDataSourceModule } from "./components/LocalDataSourceModule";
import { MastersModule } from "./components/MastersModule";
import { PaymentModule } from "./components/PaymentModule";
import { PreAuthModule } from "./components/PreAuthModule";
import { RCMModule } from "./components/RCMModule";

export type { HealthPackage };

function formatRate(rate: number): string {
  return `\u20b9${rate.toLocaleString("en-IN")}`;
}

function parseSemicolonList(val: string): string[] {
  if (!val || val.toLowerCase() === "no" || val.toLowerCase() === "none")
    return [];
  return val
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string | React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 py-2.5 border-b border-hp-border last:border-0",
        className,
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-hp-muted">
        {label}
      </span>
      <span className="text-sm text-hp-body leading-relaxed">{value}</span>
    </div>
  );
}

function PackageCard({
  pkg,
  isSelected,
  onClick,
}: {
  pkg: HealthPackage;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border cursor-pointer transition-all duration-200 p-4 hover:shadow-md hover:border-hp-blue/40 group",
        isSelected
          ? "border-hp-blue shadow-md ring-1 ring-hp-blue/20"
          : "border-hp-border",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-hp-muted uppercase tracking-wide mb-0.5">
            {pkg.packageCode}
          </p>
          <p className="text-sm font-semibold text-hp-body leading-snug line-clamp-2">
            {pkg.packageName}
          </p>
        </div>
        <Badge
          className={cn(
            "text-xs shrink-0 rounded-full",
            pkg.category === "Tertiary"
              ? "bg-blue-100 text-blue-700 border-blue-200"
              : "bg-green-100 text-green-700 border-green-200",
          )}
        >
          {pkg.category}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase text-hp-muted tracking-wide">
            Speciality
          </p>
          <p className="text-xs text-hp-body line-clamp-1">{pkg.speciality}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-hp-muted tracking-wide">
            Rate
          </p>
          <p className="text-xs font-semibold text-hp-blue">
            {formatRate(pkg.rate)}
          </p>
        </div>
      </div>
      <button
        type="button"
        data-ocid="package.view_details.button"
        className="w-full text-xs font-bold uppercase tracking-wider py-2 rounded-lg transition-all duration-200 bg-hp-bg text-hp-blue border border-hp-blue/30 hover:bg-hp-blue hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        View Details
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Wikipedia Section
// ---------------------------------------------------------------------------

interface WikiSummary {
  title: string;
  extract: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchWikipediaSummary(title: string): Promise<WikiSummary> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("not_found");
  const data = await res.json();
  if (data.type === "disambiguation") throw new Error("disambiguation");
  return data as WikiSummary;
}

async function searchWikipediaTitle(query: string): Promise<string> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("search_failed");
  const data = await res.json();
  const results = data?.query?.search;
  if (!results || results.length === 0) throw new Error("no_results");
  return results[0].title as string;
}

function WikipediaSection({
  pkg,
  isActive,
}: {
  pkg: HealthPackage;
  isActive: boolean;
}) {
  const [summary, setSummary] = useState<WikiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevPkgCode = useRef<string | null>(null);

  const fetchInfo = useCallback(async (packageName: string) => {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      let result: WikiSummary;
      try {
        result = await fetchWikipediaSummary(packageName);
      } catch {
        const foundTitle = await searchWikipediaTitle(packageName);
        result = await fetchWikipediaSummary(foundTitle);
      }
      setSummary(result);
    } catch {
      setError(
        "No Wikipedia article found for this package. Try searching Wikipedia directly.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    if (prevPkgCode.current === pkg.packageCode) return;
    prevPkgCode.current = pkg.packageCode;
    fetchInfo(pkg.packageName);
  }, [isActive, pkg, fetchInfo]);

  const handleRefresh = () => {
    prevPkgCode.current = null;
    fetchInfo(pkg.packageName);
  };

  if (loading) {
    return (
      <div data-ocid="info.loading_state" className="p-4 space-y-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-hp-muted animate-spin" />
          <span className="text-xs text-hp-muted">
            Loading Wikipedia article...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-ocid="info.error_state" className="p-4">
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <Globe className="h-4 w-4" /> Article not found
          </p>
          <p className="text-blue-700 mb-3">{error}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
            <a
              href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(pkg.packageName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
            >
              <ExternalLink className="h-3 w-3" />
              Search Wikipedia
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const wikiPageUrl =
    summary.content_urls?.desktop?.page ??
    `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`;

  return (
    <div data-ocid="info.success_state" className="p-4">
      {summary.thumbnail?.source && (
        <div className="mb-4 rounded-xl overflow-hidden border border-hp-border">
          <img
            src={summary.thumbnail.source}
            alt={summary.title}
            className="w-full max-h-48 object-cover"
          />
        </div>
      )}
      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-hp-muted mb-1">
          Wikipedia Summary
        </p>
        <h3 className="text-xl font-bold text-hp-body">{summary.title}</h3>
        <p className="text-sm text-hp-muted italic mt-0.5">{pkg.speciality}</p>
      </div>
      <p className="text-sm text-hp-body leading-relaxed">{summary.extract}</p>
      <div className="mt-5 pt-4 border-t border-hp-border flex flex-wrap items-center gap-2">
        <a
          href={wikiPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Read more on Wikipedia
        </a>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 text-xs text-hp-muted hover:text-hp-blue underline"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function DetailPanel({
  pkg,
  onClose,
}: {
  pkg: HealthPackage;
  onClose?: () => void;
}) {
  const [activeTab, setActiveTab] = useState("details");
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const pkgCodeRef = useRef(pkg.packageCode);

  useEffect(() => {
    if (pkgCodeRef.current !== pkg.packageCode) {
      pkgCodeRef.current = pkg.packageCode;
      setActiveTab("details");
    }
  });

  const preAuthDocs = parseSemicolonList(pkg.preAuthDocument);
  const claimDocs = parseSemicolonList(pkg.claimDocument);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-hp-border shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="bg-gradient-to-r from-hp-blue to-hp-navy px-5 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {pkg.packageCode}
            </p>
            <h2 className="text-white font-bold text-base leading-snug line-clamp-2">
              {pkg.packageName}
            </h2>
            <p className="text-blue-200 text-xs mt-1">{pkg.speciality}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close detail panel"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList className="w-full rounded-none border-b border-hp-border bg-white justify-start px-4 h-11 gap-0 shrink-0">
          <TabsTrigger
            data-ocid="details.tab"
            value="details"
            className="rounded-none border-b-2 px-4 h-full text-sm font-semibold transition-colors data-[state=active]:border-hp-blue data-[state=active]:text-hp-blue data-[state=inactive]:border-transparent data-[state=inactive]:text-hp-muted bg-transparent"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Package Details
          </TabsTrigger>
          <TabsTrigger
            data-ocid="information.tab"
            value="information"
            className="rounded-none border-b-2 px-4 h-full text-sm font-semibold transition-colors data-[state=active]:border-hp-blue data-[state=active]:text-hp-blue data-[state=inactive]:border-transparent data-[state=inactive]:text-hp-muted bg-transparent"
          >
            <BookOpen className="h-4 w-4 mr-1.5" />
            Information
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex-1 overflow-auto mt-0">
          <ScrollArea className="h-full">
            <div className="px-5 py-3">
              <DetailRow label="Package Code" value={pkg.packageCode} />
              <DetailRow label="Speciality" value={pkg.speciality} />
              <DetailRow
                label="Category"
                value={
                  <Badge
                    className={cn(
                      "text-xs rounded-full",
                      pkg.category === "Tertiary"
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-green-100 text-green-700 border-green-200",
                    )}
                  >
                    {pkg.category}
                  </Badge>
                }
              />
              <DetailRow
                label="Procedure Type"
                value={pkg.procedureType.replace(/[\[\]]/g, "")}
              />
              <DetailRow
                label="Rate"
                value={
                  <span className="font-bold text-hp-blue text-base">
                    {formatRate(pkg.rate)}
                  </span>
                }
              />
              <DetailRow label="2 Hour Flag" value={pkg.twoHrFlag} />
              <DetailRow label="Govt. Reserve" value={pkg.govtReserve} />
              <DetailRow label="RTA Flag" value={pkg.rtaFlag} />
              <DetailRow label="Implant Package" value={pkg.implantPackage} />
              {pkg.packageDetails && (
                <DetailRow label="Package Details" value={pkg.packageDetails} />
              )}
              <DetailRow
                label="Pre-Auth Documents"
                value={
                  preAuthDocs.length > 0 ? (
                    <ul className="list-none space-y-1 mt-1">
                      {preAuthDocs.map((doc) => (
                        <li
                          key={doc}
                          className="flex items-start gap-1.5 text-xs text-hp-body"
                        >
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-hp-blue shrink-0" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-hp-muted text-xs">
                      None specified
                    </span>
                  )
                }
              />
              <DetailRow
                label="Claim Documents"
                value={
                  claimDocs.length > 0 ? (
                    <ul className="list-none space-y-1 mt-1">
                      {claimDocs.map((doc) => (
                        <li
                          key={doc}
                          className="flex items-start gap-1.5 text-xs text-hp-body"
                        >
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-hp-blue shrink-0" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-hp-muted text-xs">
                      None specified
                    </span>
                  )
                }
              />
              {pkg.specialCondition &&
                pkg.specialCondition.toLowerCase() !==
                  "no special condition" && (
                  <DetailRow
                    label="Special Condition"
                    value={pkg.specialCondition}
                  />
                )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="information" className="flex-1 overflow-auto mt-0">
          <ScrollArea className="h-full">
            <WikipediaSection
              pkg={pkg}
              isActive={activeTab === "information"}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Generate Notes Footer Button */}
      <div className="shrink-0 px-4 py-3 border-t border-hp-border bg-white">
        <Button
          data-ocid="generate_notes.open_modal_button"
          onClick={() => setNotesModalOpen(true)}
          className="w-full h-10 bg-hp-blue hover:bg-hp-navy text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <ClipboardList className="h-4 w-4" />
          Generate Clinical Notes
        </Button>
      </div>

      <GenerateNotesModal
        pkg={pkg}
        open={notesModalOpen}
        onOpenChange={setNotesModalOpen}
      />
    </div>
  );
}

function PageFooter() {
  return (
    <footer className="bg-hp-navy border-t border-white/10 py-6 px-4 mt-auto">
      <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          <span className="text-white font-semibold text-sm">
            Health Package Finder
          </span>
        </div>
        <p className="text-blue-300 text-xs text-center">
          Data sourced from government health insurance package lists. Medical
          descriptions sourced from Wikipedia.
        </p>
        <p className="text-blue-400 text-xs">
          &copy; {new Date().getFullYear()}. Built with &#9829; using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Standalone Detail Page (opened in new tab via ?pkg=...)
// ---------------------------------------------------------------------------

function StandaloneDetailPage({ pkgCode }: { pkgCode: string }) {
  const [packages, setPackages] = useState<HealthPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/assets/packages.json")
      .then((r) => r.json())
      .then((data: HealthPackage[]) => {
        setPackages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const matchedPkg = packages.find((p) => p.packageCode === pkgCode);

  return (
    <div className="min-h-screen flex flex-col bg-hp-bg">
      <Toaster richColors position="top-right" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-hp-blue to-hp-navy shadow-md">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <a
            href={window.location.pathname}
            className="flex items-center gap-2"
          >
            <div className="bg-white/15 rounded-lg p-1.5">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight hidden sm:block">
              Health Package Finder
            </span>
            <span className="text-white font-bold text-base tracking-tight sm:hidden">
              HPF
            </span>
          </a>
          <a
            href={window.location.pathname}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to Search</span>
          </a>
        </div>
      </header>

      <main className="flex-1 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div data-ocid="detail_page.loading_state" className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : !matchedPkg ? (
            <div
              data-ocid="detail_page.error_state"
              className="bg-white rounded-2xl border border-hp-border shadow-sm p-10 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <Package className="h-8 w-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-hp-body mb-2">
                Package not found
              </h2>
              <p className="text-sm text-hp-muted mb-6">
                No package matched the code{" "}
                <span className="font-semibold text-hp-body">{pkgCode}</span>.
              </p>
              <a
                href={window.location.pathname}
                className="inline-flex items-center gap-2 bg-hp-blue text-white font-bold px-5 py-2.5 rounded-xl hover:bg-hp-navy transition-colors text-sm"
              >
                <Search className="h-4 w-4" />
                Back to Search
              </a>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{ height: "calc(100vh - 160px)", minHeight: "500px" }}
              className="flex flex-col"
            >
              <DetailPanel pkg={matchedPkg} />
            </motion.div>
          )}
        </div>
      </main>

      <PageFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App (search + browse)
// ---------------------------------------------------------------------------

function MainApp() {
  const [packages, setPackages] = useState<HealthPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [specialityFilter, setSpecialityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activePage, setActivePage] = useState<
    | "home"
    | "find"
    | "about"
    | "rcm"
    | "preauth"
    | "clinicaldocs"
    | "claims"
    | "payment"
    | "masters"
    | "datasource"
  >("home");
  const [prefill, setPrefill] = useState<Record<string, unknown>>({});

  function handleNavigate(page: string, data?: Record<string, unknown>) {
    setActivePage(page as Parameters<typeof setActivePage>[0]);
    if (data) setPrefill(data);
  }

  function handlePrefillConsumed() {
    setPrefill({});
  }

  useEffect(() => {
    fetch("/assets/packages.json")
      .then((r) => r.json())
      .then((data: HealthPackage[]) => {
        setPackages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const specialities = Array.from(
    new Set(packages.map((p) => p.speciality)),
  ).sort();

  const filtered = packages.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.packageName.toLowerCase().includes(q) ||
      p.packageCode.toLowerCase().includes(q) ||
      p.speciality.toLowerCase().includes(q) ||
      p.packageDetails.toLowerCase().includes(q);
    const matchesSpeciality =
      specialityFilter === "all" || p.speciality === specialityFilter;
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesSpeciality && matchesCategory;
  });

  const handleSelect = (pkg: HealthPackage) => {
    window.open(
      `${window.location.pathname}?pkg=${encodeURIComponent(pkg.packageCode)}`,
      "_blank",
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-hp-bg">
      <Toaster richColors position="top-right" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-hp-blue to-hp-navy shadow-md">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            data-ocid="header.home.link"
            onClick={() => setActivePage("home")}
            className="flex items-center gap-2 group"
          >
            <div className="bg-white/15 rounded-lg p-1.5">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight hidden sm:block">
              Health Package Finder
            </span>
            <span className="text-white font-bold text-base tracking-tight sm:hidden">
              HPF
            </span>
          </button>

          <nav className="flex items-center gap-1">
            <button
              type="button"
              data-ocid="nav.home.link"
              onClick={() => setActivePage("home")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "home"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <Home className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Home</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.find.link"
              onClick={() => setActivePage("find")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "find"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Find Packages</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.about.link"
              onClick={() => setActivePage("about")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "about"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">About</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.rcm.link"
              onClick={() => setActivePage("rcm")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "rcm"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">RCM</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.preauth.link"
              onClick={() => setActivePage("preauth")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "preauth"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <FileCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Pre-Auth</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.clinicaldocs.link"
              onClick={() => setActivePage("clinicaldocs")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "clinicaldocs"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clinical Docs</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.claims.link"
              onClick={() => setActivePage("claims")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "claims"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Claims</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.payment.link"
              onClick={() => setActivePage("payment")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "payment"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Payment</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.masters.link"
              onClick={() => setActivePage("masters")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "masters"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Masters</span>
              </span>
            </button>
            <button
              type="button"
              data-ocid="nav.datasource.link"
              onClick={() => setActivePage("datasource")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activePage === "datasource"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Data</span>
              </span>
            </button>
          </nav>

          <Button
            data-ocid="header.find_packages.button"
            onClick={() => setActivePage("find")}
            size="sm"
            className="bg-white text-hp-blue font-bold hover:bg-blue-50 rounded-lg text-xs px-3 hidden sm:flex"
          >
            <Package className="h-3.5 w-3.5 mr-1" />
            Browse
          </Button>
        </div>
      </header>

      {/* Home Page */}
      <AnimatePresence mode="wait">
        {activePage === "home" && (
          <motion.main
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-hp-blue via-hp-navy to-[#062035] text-white py-16 px-4">
              <div className="max-w-3xl mx-auto text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm font-medium mb-6 border border-white/20">
                    <Activity className="h-4 w-4 text-blue-300" />
                    <span className="text-blue-100">
                      Health Insurance Package Database
                    </span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
                    Find Health Insurance
                    <span className="block text-blue-300">
                      Packages &amp; Procedures
                    </span>
                  </h1>
                  <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                    Search thousands of medical procedures and health insurance
                    packages. Get detailed information including rates,
                    coverage, and required documents.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      data-ocid="hero.find_packages.button"
                      onClick={() => setActivePage("find")}
                      size="lg"
                      className="bg-white text-hp-blue font-bold hover:bg-blue-50 rounded-xl text-base px-8"
                    >
                      <Search className="h-5 w-5 mr-2" />
                      Find Packages
                    </Button>
                    <Button
                      data-ocid="hero.about.button"
                      onClick={() => setActivePage("about")}
                      variant="outline"
                      size="lg"
                      className="border-white/40 text-white hover:bg-white/10 rounded-xl text-base px-8 bg-transparent"
                    >
                      Learn More
                    </Button>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* Stats */}
            <section className="bg-white border-b border-hp-border py-8 px-4">
              <div className="max-w-screen-lg mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                  {[
                    {
                      label: "Total Packages",
                      value: packages.length.toLocaleString("en-IN"),
                    },
                    {
                      label: "Specialities",
                      value: specialities.length.toLocaleString("en-IN"),
                    },
                    {
                      label: "Tertiary Care",
                      value: packages
                        .filter((p) => p.category === "Tertiary")
                        .length.toLocaleString("en-IN"),
                    },
                    {
                      label: "Secondary Care",
                      value: packages
                        .filter((p) => p.category === "Secondary")
                        .length.toLocaleString("en-IN"),
                    },
                  ].map((stat) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <p className="text-3xl font-bold text-hp-blue">
                        {loading ? "\u2014" : stat.value}
                      </p>
                      <p className="text-sm text-hp-muted mt-0.5">
                        {stat.label}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Feature Cards */}
            <section className="flex-1 py-12 px-4">
              <div className="max-w-screen-lg mx-auto">
                <h2 className="text-2xl font-bold text-hp-body text-center mb-8">
                  How It Works
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      icon: Search,
                      title: "Search by Disease or Package",
                      desc: "Enter any disease name, procedure name, or package code to instantly find matching health insurance packages.",
                    },
                    {
                      icon: FileText,
                      title: "View Package Details",
                      desc: "Get complete details: rates, eligibility, required documents for pre-authorization and claims.",
                    },
                    {
                      icon: ClipboardList,
                      title: "Generate Clinical Notes",
                      desc: "Instantly generate OT notes, Anesthesia records, and Discharge Summaries as editable Word documents.",
                    },
                    {
                      icon: Receipt,
                      title: "Claims Management",
                      desc: "Submit, track, and manage insurance claims end-to-end with real-time status updates and settlement tracking.",
                    },
                  ].map((item) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="bg-white rounded-2xl border border-hp-border p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 bg-hp-blue/10 rounded-xl flex items-center justify-center mb-4">
                        <item.icon className="h-6 w-6 text-hp-blue" />
                      </div>
                      <h3 className="font-bold text-hp-body mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-hp-muted leading-relaxed">
                        {item.desc}
                      </p>
                    </motion.div>
                  ))}
                </div>
                <div className="text-center mt-10">
                  <Button
                    data-ocid="cta.find_packages.button"
                    onClick={() => setActivePage("find")}
                    size="lg"
                    className="bg-hp-blue text-white font-bold hover:bg-hp-navy rounded-xl px-10"
                  >
                    Start Searching
                    <ChevronRight className="h-5 w-5 ml-1" />
                  </Button>
                </div>
              </div>
            </section>
          </motion.main>
        )}

        {/* Find Page */}
        {activePage === "find" && (
          <motion.main
            key="find"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {/* Search Bar */}
            <div className="sticky top-14 z-20 bg-white border-b border-hp-border shadow-sm">
              <div className="max-w-screen-xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-hp-muted" />
                  <input
                    data-ocid="search.input"
                    type="text"
                    placeholder="Search disease, package name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-hp-border rounded-lg bg-hp-bg focus:outline-none focus:ring-2 focus:ring-hp-blue/30 focus:border-hp-blue transition"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    data-ocid="speciality.select"
                    value={specialityFilter}
                    onChange={(e) => setSpecialityFilter(e.target.value)}
                    className="text-sm border border-hp-border rounded-lg px-3 py-2 bg-hp-bg text-hp-body focus:outline-none focus:ring-2 focus:ring-hp-blue/30 min-w-[130px]"
                  >
                    <option value="all">All Specialities</option>
                    {specialities.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    data-ocid="category.select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-sm border border-hp-border rounded-lg px-3 py-2 bg-hp-bg text-hp-body focus:outline-none focus:ring-2 focus:ring-hp-blue/30"
                  >
                    <option value="all">All Categories</option>
                    <option value="Tertiary">Tertiary</option>
                    <option value="Secondary">Secondary</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-1 min-h-0 max-w-screen-xl mx-auto w-full px-4 py-4 gap-4">
              {/* Left: Package List */}
              <div className="flex-1 min-w-0 overflow-y-auto">
                {loading ? (
                  <div
                    data-ocid="results.loading_state"
                    className="space-y-3 pb-4"
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton
                      <Skeleton key={i} className="h-36 w-full rounded-xl" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div
                    data-ocid="results.empty_state"
                    className="text-center py-16"
                  >
                    <Package className="h-12 w-12 text-hp-muted/40 mx-auto mb-3" />
                    <p className="font-semibold text-hp-body">
                      No packages found
                    </p>
                    <p className="text-sm text-hp-muted mt-1">
                      Try adjusting your search query or filters.
                    </p>
                  </div>
                ) : (
                  <div data-ocid="results.list" className="space-y-3 pb-4">
                    <AnimatePresence initial={false}>
                      {filtered.map((pkg) => (
                        <PackageCard
                          key={pkg.packageCode}
                          pkg={pkg}
                          isSelected={false}
                          onClick={() => handleSelect(pkg)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Right: Hint Panel (desktop only) */}
              <div
                className="hidden lg:flex lg:flex-col lg:w-[45%] min-h-0 sticky top-[112px] self-start"
                style={{ maxHeight: "calc(100vh - 120px)" }}
              >
                <div className="bg-white rounded-2xl border border-hp-border flex-1 flex flex-col items-center justify-center p-10 text-center">
                  <div className="w-16 h-16 bg-hp-bg rounded-2xl flex items-center justify-center mb-4">
                    <ExternalLink className="h-8 w-8 text-hp-blue/40" />
                  </div>
                  <p className="font-semibold text-hp-body mb-1">
                    Details open in a new tab
                  </p>
                  <p className="text-sm text-hp-muted">
                    Click any package to open its details in a new tab.
                  </p>
                </div>
              </div>
            </div>
          </motion.main>
        )}

        {/* About Page */}
        {activePage === "about" && (
          <motion.main
            key="about"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 py-12 px-4"
          >
            <div className="max-w-2xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-hp-border shadow-sm p-8"
              >
                <h1 className="text-2xl font-bold text-hp-body mb-4">
                  About Health Package Finder
                </h1>
                <p className="text-hp-muted leading-relaxed mb-4">
                  Health Package Finder is a comprehensive search tool for
                  government health insurance packages under the Ayushman Bharat
                  &#8211; Pradhan Mantri Jan Arogya Yojana (AB-PMJAY) scheme and
                  similar health coverage programs.
                </p>
                <p className="text-hp-muted leading-relaxed mb-4">
                  Search through thousands of medical procedures, disease
                  treatments, and health packages to find rates, eligibility
                  criteria, required documents for claims and pre-authorization,
                  and detailed medical information.
                </p>
                <h2 className="text-lg font-bold text-hp-body mt-6 mb-3">
                  Key Features
                </h2>
                <ul className="space-y-2">
                  {[
                    "Real-time search across thousands of health packages",
                    "Filter by medical speciality and care category",
                    "Detailed package view with all coverage info",
                    "Wikipedia-powered medical descriptions \u2014 no API key required",
                    "Pre-auth and claim document checklists",
                    "Generate OT Notes, Anesthesia Records & Discharge Summaries as editable Word files",
                    "End-to-end claims submission and settlement tracking (Module 4)",
                  ].map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-hp-muted"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-hp-blue shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
                  <Globe className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800 mb-0.5">
                      Powered by Wikipedia
                    </p>
                    <p className="text-xs text-blue-600">
                      Medical descriptions are sourced from Wikipedia — free,
                      open, and always available with no API key required. Click
                      the Information tab on any package to read its Wikipedia
                      summary.
                    </p>
                  </div>
                </div>
                <div className="mt-8">
                  <Button
                    data-ocid="about.find_packages.button"
                    onClick={() => setActivePage("find")}
                    className="bg-hp-blue text-white font-bold hover:bg-hp-navy rounded-xl"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Start Searching
                  </Button>
                </div>
              </motion.div>
            </div>
          </motion.main>
        )}
        {activePage === "rcm" && (
          <RCMModule key="rcm" onNavigate={handleNavigate} />
        )}
        {activePage === "preauth" && (
          <PreAuthModule
            key="preauth"
            onNavigate={handleNavigate}
            prefill={prefill}
            onPrefillConsumed={handlePrefillConsumed}
          />
        )}
        {activePage === "clinicaldocs" && (
          <ClinicalDocsModule key="clinicaldocs" onNavigate={handleNavigate} />
        )}
        {activePage === "claims" && (
          <ClaimsModule
            key="claims"
            onNavigate={handleNavigate}
            prefill={prefill}
            onPrefillConsumed={handlePrefillConsumed}
          />
        )}
        {activePage === "payment" && (
          <PaymentModule
            key="payment"
            onNavigate={handleNavigate}
            prefill={prefill}
            onPrefillConsumed={handlePrefillConsumed}
          />
        )}
        {activePage === "masters" && <MastersModule key="masters" />}
        {activePage === "datasource" && (
          <LocalDataSourceModule key="datasource" />
        )}
      </AnimatePresence>

      <PageFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root App — routes between standalone detail view and main app
// ---------------------------------------------------------------------------

export default function App() {
  const pkgCodeParam = new URLSearchParams(window.location.search).get("pkg");

  if (pkgCodeParam !== null) {
    return <StandaloneDetailPage pkgCode={pkgCodeParam} />;
  }

  return <MainApp />;
}
