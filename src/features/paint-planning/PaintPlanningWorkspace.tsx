import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import i18nInstance from "../../i18n";
import {
  calculatePaintConsumption,
  createId,
  paintColorSchema,
  paintMixNoteSchema,
  suggestPaintMix,
  type PaintAmountUnit,
  type PaintColor,
  type PaintConsumptionEstimate,
  type PaintMixNote,
  type PaintMixSuggestion,
  type PaletteExtraction,
  type Project,
  type ProjectWorkspace,
} from "../../domain";
import { paintPlanningRepository } from "../../storage";

type PaintDraft = {
  manufacturer: string;
  name: string;
  pigmentCode: string;
  hex: string;
};

const emptyPaintDraft: PaintDraft = {
  manufacturer: "",
  name: "",
  pigmentCode: "",
  hex: "#808080",
};

function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  return value.toLocaleString(locale, { maximumFractionDigits });
}

function sortPaints(paints: PaintColor[], locale: string): PaintColor[] {
  return [...paints].sort((first, second) =>
    first.manufacturer.localeCompare(second.manufacturer, locale)
    || first.name.localeCompare(second.name, locale)
    || first.id.localeCompare(second.id),
  );
}

function mixDescription(suggestion: PaintMixSuggestion, locale: string): string {
  return suggestion.components
    .map(({ paint, fraction }) =>
      `${paint.manufacturer} · ${paint.name} (${formatNumber(fraction * 100, locale)}%)`,
    )
    .join(" + ");
}

function PaintInventoryForm({
  draft,
  editing,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: PaintDraft;
  editing: boolean;
  busy: boolean;
  onChange: (draft: PaintDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <h4 className="text-sm font-semibold text-stone-800">
        {editing ? t("paint.editPaint") : t("paint.addPaint")}
      </h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium text-stone-600">
          {t("paint.manufacturer")}
          <input
            required
            maxLength={100}
            value={draft.manufacturer}
            onChange={(event) => onChange({ ...draft, manufacturer: event.target.value })}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-stone-600">
          {t("paint.name")}
          <input
            required
            maxLength={100}
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-stone-600">
          {t("paint.pigmentCode")}
          <input
            maxLength={64}
            value={draft.pigmentCode}
            onChange={(event) => onChange({ ...draft, pigmentCode: event.target.value })}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-stone-600">
          {t("paint.digitalSwatch")}
          <span className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-1.5">
            <input
              type="color"
              aria-label={t("paint.swatchLabel")}
              value={draft.hex}
              onChange={(event) => onChange({ ...draft, hex: event.target.value.toUpperCase() })}
              className="size-8 cursor-pointer border-0 bg-transparent p-0"
            />
            <span className="text-sm text-stone-700">{draft.hex.toUpperCase()}</span>
          </span>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {editing ? t("paint.savePaint") : t("paint.addPaint")}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-white disabled:opacity-50"
          >
            {t("paint.cancelEdit")}
          </button>
        )}
      </div>
    </form>
  );
}

function PaletteEstimateTable({
  estimate,
  unit,
}: {
  estimate: PaintConsumptionEstimate;
  unit: PaintAmountUnit;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-stone-200 text-stone-500">
            <th scope="col" className="px-3 py-2 font-semibold">{t("paint.tableColor")}</th>
            <th scope="col" className="px-3 py-2 font-semibold">{t("paint.tableArea")}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">{t("paint.tableEstimated")}</th>
          </tr>
        </thead>
        <tbody>
          {estimate.paletteRows.map((row) => (
            <tr key={row.number} className="border-b border-stone-100 last:border-0">
              <th scope="row" className="px-3 py-2 font-medium text-stone-700">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-4 rounded border border-black/10" style={{ backgroundColor: row.hex }} />
                  {row.number} · {row.hex}
                </span>
              </th>
              <td className="px-3 py-2 text-stone-600">{formatNumber(row.areaPercent, i18n.language)}%</td>
              <td className="px-3 py-2 text-right font-medium text-stone-800">
                {formatNumber(row.quantity, i18n.language, 2)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaintDemandTable({
  estimate,
  unit,
}: {
  estimate: PaintConsumptionEstimate;
  unit: PaintAmountUnit;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-stone-200 text-stone-500">
            <th scope="col" className="px-3 py-2 font-semibold">{t("paint.tablePaint")}</th>
            <th scope="col" className="px-3 py-2 font-semibold">{t("paint.tableCode")}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">{t("paint.tableEstimated")}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">{t("paint.tableTotalPercent")}</th>
          </tr>
        </thead>
        <tbody>
          {estimate.paintRows.map(({ paint, quantity, percentOfTotal }) => (
            <tr key={paint.id} className="border-b border-stone-100 last:border-0">
              <th scope="row" className="px-3 py-2 font-medium text-stone-700">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-4 rounded border border-black/10" style={{ backgroundColor: paint.hex }} />
                  {paint.manufacturer} · {paint.name}
                </span>
              </th>
              <td className="px-3 py-2 text-stone-600">{paint.pigmentCode || "—"}</td>
              <td className="px-3 py-2 text-right font-medium text-stone-800">
                {formatNumber(quantity, i18n.language, 2)} {unit}
              </td>
              <td className="px-3 py-2 text-right text-stone-600">{formatNumber(percentOfTotal, i18n.language)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaintPlanningWorkspace({
  project,
  palette,
  preferences,
  onPreferencesChange,
}: {
  project: Project;
  palette: PaletteExtraction | null;
  preferences: ProjectWorkspace["paint"];
  onPreferencesChange: (update: Partial<ProjectWorkspace["paint"]>) => void;
}) {
  const { t, i18n } = useTranslation();
  const [paints, setPaints] = useState<PaintColor[]>([]);
  const [mixNotes, setMixNotes] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<PaintDraft>(preferences.draft);
  const [editingPaintId, setEditingPaintId] = useState<string | null>(preferences.editingPaintId);
  const [totalAmount, setTotalAmount] = useState(preferences.totalAmount);
  const [unit, setUnit] = useState<PaintAmountUnit>(preferences.unit);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      paintPlanningRepository.listPaintColors(project.id),
      paintPlanningRepository.listMixNotes(project.id),
    ])
      .then(([storedPaints, storedNotes]) => {
        if (!active) return;
        const noteValues = Object.fromEntries(
          storedNotes.map((note) => [note.targetHex, note.note]),
        );
        setPaints(storedPaints);
        setMixNotes(noteValues);
        setNoteDrafts(noteValues);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error
            ? i18nInstance.t("paint.loadError", { details: loadError.message })
            : i18nInstance.t("paint.loadFailed"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [project.id]);

  useEffect(() => {
    setDraft(preferences.draft);
    setEditingPaintId(preferences.editingPaintId);
    setTotalAmount(preferences.totalAmount);
    setUnit(preferences.unit);
  }, [preferences]);

  useEffect(() => {
    if (loading || Object.keys(noteDrafts).length === 0) return undefined;
    const timer = window.setTimeout(() => {
      Promise.all(Object.entries(noteDrafts).map(async ([targetHex, note]) => {
        if (note.trim() === "") {
          await paintPlanningRepository.deleteMixNote(project.id, targetHex);
          return;
        }
        await paintPlanningRepository.saveMixNote(paintMixNoteSchema.parse({
          id: `mix-note:v1:${project.id}:${targetHex}`,
          schemaVersion: 1,
          projectId: project.id,
          targetHex,
          note,
          updatedAt: new Date().toISOString(),
        }));
      }))
        .then(() => {
          setMixNotes(noteDrafts);
          setStatus(t("paint.noteAutoSaved"));
        })
        .catch((saveError: unknown) => {
          setError(saveError instanceof Error
            ? t("paint.noteSaveError", { details: saveError.message })
            : t("paint.noteSaveFailed"));
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loading, noteDrafts, project.id, t]);

  const suggestions = useMemo(
    () => palette?.colors.map((color) => suggestPaintMix(color.hex, paints)) ?? [],
    [palette, paints],
  );
  const parsedAmount = Number(totalAmount);
  const validAmount = totalAmount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const estimate = useMemo(() => {
    if (!palette || !validAmount) return null;
    return calculatePaintConsumption(
      palette.colors,
      parsedAmount,
      suggestions,
    );
  }, [palette, parsedAmount, suggestions, validAmount]);

  function resetPaintDraft() {
    setDraft(emptyPaintDraft);
    setEditingPaintId(null);
    onPreferencesChange({ draft: emptyPaintDraft, editingPaintId: null });
  }

  function handleDraftChange(nextDraft: PaintDraft) {
    setDraft(nextDraft);
    onPreferencesChange({ draft: nextDraft });
  }

  async function handleSavePaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date().toISOString();
    const existing = paints.find((paint) => paint.id === editingPaintId);
    const parsed = paintColorSchema.safeParse({
      id: existing?.id ?? createId<"PaintId">(),
      schemaVersion: 1,
      projectId: project.id,
      manufacturer: draft.manufacturer,
      name: draft.name,
      pigmentCode: draft.pigmentCode,
      hex: draft.hex,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (!parsed.success) {
      setError(t("paint.validation"));
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("");
    try {
      await paintPlanningRepository.savePaintColor(parsed.data);
      setPaints((current) => sortPaints([
        ...current.filter((paint) => paint.id !== parsed.data.id),
        parsed.data,
      ], i18n.language));
      setStatus(existing ? t("paint.saved") : t("paint.added"));
      resetPaintDraft();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error
        ? t("paint.saveError", { details: saveError.message })
        : t("paint.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  function handleEditPaint(paint: PaintColor) {
    setDraft({
      manufacturer: paint.manufacturer,
      name: paint.name,
      pigmentCode: paint.pigmentCode,
      hex: paint.hex,
    });
    setEditingPaintId(paint.id);
    onPreferencesChange({
      draft: {
        manufacturer: paint.manufacturer,
        name: paint.name,
        pigmentCode: paint.pigmentCode,
        hex: paint.hex,
      },
      editingPaintId: paint.id,
    });
    setError(null);
    setStatus("");
  }

  async function handleDeletePaint(paint: PaintColor) {
    setBusy(true);
    setError(null);
    setStatus("");
    try {
      await paintPlanningRepository.deletePaintColor(paint.id);
      setPaints((current) => current.filter((item) => item.id !== paint.id));
      if (editingPaintId === paint.id) resetPaintDraft();
      setStatus(t("paint.removed", { name: paint.name }));
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error
        ? t("paint.deleteError", { details: deleteError.message })
        : t("paint.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNote(targetHex: string, colorNumber: number) {
    const noteText = noteDrafts[targetHex] ?? "";
    setError(null);
    setStatus("");
    try {
      if (noteText.trim() === "") {
        await paintPlanningRepository.deleteMixNote(project.id, targetHex);
        setMixNotes((current) => {
          const next = { ...current };
          delete next[targetHex];
          return next;
        });
        setNoteDrafts((current) => {
          const next = { ...current };
          delete next[targetHex];
          return next;
        });
        setStatus(t("paint.noteDeleted", { number: colorNumber }));
        return;
      }

      const savedNote: PaintMixNote = paintMixNoteSchema.parse({
        id: `mix-note:v1:${project.id}:${targetHex}`,
        schemaVersion: 1,
        projectId: project.id,
        targetHex,
        note: noteText,
        updatedAt: new Date().toISOString(),
      });
      await paintPlanningRepository.saveMixNote(savedNote);
      setMixNotes((current) => ({ ...current, [savedNote.targetHex]: savedNote.note }));
      setNoteDrafts((current) => ({ ...current, [savedNote.targetHex]: savedNote.note }));
      setStatus(t("paint.noteSavedStatus", { number: colorNumber }));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error
        ? t("paint.noteSaveError", { details: saveError.message })
        : t("paint.noteSaveFailed"));
    }
  }

  const amountMessage = validAmount
    ? ""
    : t("paint.amountInvalid");

  return (
    <section
      aria-labelledby="paint-planning-heading"
      id="step-paint-planning"
      className="rounded-2xl border border-stone-200 bg-white/85 p-6 shadow-sm"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
          {t("paint.eyebrow")}
        </p>
        <h2 id="paint-planning-heading" className="mt-2 text-xl font-semibold">
          {t("paint.heading")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          {t("paint.description")}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs text-stone-500">
        {loading ? t("paint.loadInventory") : status}
      </p>

      <section aria-labelledby="paint-inventory-heading" className="mt-4 border-t border-stone-100 pt-5">
        <h3 id="paint-inventory-heading" className="text-base font-semibold text-stone-800">
          {t("paint.inventory")}
        </h3>
        {paints.length === 0 && !loading ? (
          <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("paint.noPaints")}
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {paints.map((paint) => (
              <li key={paint.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-stone-200 p-3">
                <span
                  aria-hidden="true"
                  className="size-9 shrink-0 rounded-md border border-black/10"
                  style={{ backgroundColor: paint.hex }}
                />
                <span className="min-w-0 flex-1 text-xs leading-5 text-stone-700">
                  <strong className="block truncate">{paint.manufacturer} · {paint.name}</strong>
                  <span>{paint.pigmentCode || t("paint.noCode")} · {paint.hex}</span>
                </span>
                <span className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditPaint(paint)}
                    disabled={busy}
                    aria-label={t("paint.editPaintLabel", { name: paint.name })}
                    className="rounded border border-stone-300 px-2 py-1 text-[10px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {t("paint.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeletePaint(paint)}
                    disabled={busy}
                    aria-label={t("paint.deletePaintLabel", { name: paint.name })}
                    className="rounded border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {t("paint.delete")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <PaintInventoryForm
          draft={draft}
          editing={editingPaintId !== null}
          busy={busy || loading}
          onChange={handleDraftChange}
          onSubmit={(event) => void handleSavePaint(event)}
          onCancel={resetPaintDraft}
        />
      </section>

      <section aria-labelledby="mixing-heading" className="mt-6 border-t border-stone-100 pt-5">
        <h3 id="mixing-heading" className="text-base font-semibold text-stone-800">
          {t("paint.mixingHeading")}
        </h3>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          {t("paint.mixingDescription")}
        </p>
        {!palette ? (
          <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("paint.makePalette")}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {palette.colors.map((color, index) => {
              const suggestion = suggestions[index];
              const savedNote = mixNotes[color.hex] ?? "";
              return (
                <article key={color.number} className="rounded-xl border border-stone-200 bg-white p-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                    <span aria-hidden="true" className="size-5 rounded border border-black/10" style={{ backgroundColor: color.hex }} />
                    {color.number} · {color.hex}
                  </h4>
                  {loading ? (
                    <p className="mt-3 text-xs text-stone-500">{t("paint.inventoryPending")}</p>
                  ) : suggestion ? (
                    <>
                      <p className="mt-3 text-xs leading-5 text-stone-700">
                        {t("paint.suggestedMix", { mix: mixDescription(suggestion, i18n.language) })}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">
                        {t("paint.estimatedColor")} <strong>{suggestion.estimatedHex}</strong>
                        {" · "}{t("paint.rgbDifference")} {formatNumber(suggestion.rgbDistance, i18n.language, 1)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-xs text-stone-500">
                      {t("paint.addForSuggestion")}
                    </p>
                  )}
                  <label className="mt-3 grid gap-1.5 text-xs font-medium text-stone-600">
                    {t("paint.noteLabel")}
                    <textarea
                      rows={2}
                      maxLength={500}
                      aria-label={t("paint.noteAria", { number: color.number })}
                      value={noteDrafts[color.hex] ?? savedNote}
                      onChange={(event) => setNoteDrafts((current) => ({
                        ...current,
                        [color.hex]: event.target.value,
                      }))}
                      className="resize-y rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800"
                      placeholder={t("paint.notePlaceholder")}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSaveNote(color.hex, color.number)}
                    disabled={loading}
                    aria-label={t("paint.saveNoteAria", { number: color.number })}
                    className="mt-2 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {t("paint.saveNote")}
                  </button>
                  {savedNote && (
                    <span className="ml-2 text-[10px] text-emerald-800">{t("paint.noteSaved")}</span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="consumption-heading" className="mt-6 border-t border-stone-100 pt-5">
        <h3 id="consumption-heading" className="text-base font-semibold text-stone-800">
          {t("paint.consumptionHeading")}
        </h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">
          {t("paint.consumptionDescription")}
        </p>
        <div className="mt-4 grid gap-3 sm:max-w-lg sm:grid-cols-[minmax(0,1fr)_8rem]">
          <label className="grid gap-1.5 text-xs font-medium text-stone-600">
            {t("paint.totalAmount")}
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={totalAmount}
              onChange={(event) => {
                setTotalAmount(event.target.value);
                onPreferencesChange({ totalAmount: event.target.value });
              }}
              className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-800"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-stone-600">
            {t("paint.amountUnit")}
            <select
              value={unit}
              onChange={(event) => {
                const nextUnit = event.target.value as PaintAmountUnit;
                setUnit(nextUnit);
                onPreferencesChange({ unit: nextUnit });
              }}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800"
            >
              <option value="g">{t("paint.grams")}</option>
              <option value="ml">{t("paint.millilitres")}</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-5">
          <section aria-labelledby="palette-consumption-heading">
            <h4 id="palette-consumption-heading" className="text-sm font-semibold text-stone-800">
              {t("paint.paletteAmountHeading")}
            </h4>
            {!palette ? (
              <p role="status" className="mt-2 text-xs text-amber-800">{t("paint.makePaletteForArea")}</p>
            ) : !validAmount ? (
              <p role="status" className="mt-2 text-xs text-amber-800">{amountMessage}</p>
            ) : (
              <div className="mt-2 rounded-lg border border-stone-200">
                {estimate && <PaletteEstimateTable estimate={estimate} unit={unit} />}
              </div>
            )}
          </section>
          <section aria-labelledby="paint-consumption-heading">
            <h4 id="paint-consumption-heading" className="text-sm font-semibold text-stone-800">
              {t("paint.paintAmountHeading")}
            </h4>
            {!palette ? (
              <p role="status" className="mt-2 text-xs text-amber-800">{t("paint.makePaletteForPaint")}</p>
            ) : !validAmount ? (
              <p role="status" className="mt-2 text-xs text-amber-800">{amountMessage}</p>
            ) : loading ? (
              <p role="status" className="mt-2 text-xs text-stone-500">{t("paint.inventoryForEstimate")}</p>
            ) : paints.length === 0 ? (
              <p role="status" className="mt-2 text-xs text-amber-800">
                {t("paint.addPaintsForTotal")}
              </p>
            ) : estimate && estimate.unmatchedPaletteNumbers.length > 0 ? (
              <p role="status" className="mt-2 text-xs text-amber-800">
                {t("paint.missingMixes")}
              </p>
            ) : estimate ? (
              <div className="mt-2 rounded-lg border border-stone-200">
                <PaintDemandTable estimate={estimate} unit={unit} />
              </div>
            ) : null}
          </section>
        </div>
        {palette && validAmount && (
          <p className="mt-3 text-[11px] leading-5 text-stone-500">
            {t("paint.rounding")}
          </p>
        )}
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          {t("paint.caveat")}
        </p>
      </section>
    </section>
  );
}
