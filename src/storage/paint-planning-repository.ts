import { paintColorSchema, paintMixNoteSchema } from "../domain";
import type { PaintColor, PaintMixNote, ProjectId } from "../domain";
import { database } from "./db";

export class PaintPlanningRepository {
  async listPaintColors(projectId: ProjectId): Promise<PaintColor[]> {
    const records = await database.paintColors.where("projectId").equals(projectId).toArray();
    return records.map((record) => paintColorSchema.parse(record))
      .sort((first, second) =>
        first.manufacturer.localeCompare(second.manufacturer, "hu")
        || first.name.localeCompare(second.name, "hu")
        || first.id.localeCompare(second.id),
      );
  }

  async savePaintColor(paint: PaintColor): Promise<void> {
    await database.paintColors.put(paintColorSchema.parse(paint));
  }

  async deletePaintColor(paintId: string): Promise<void> {
    await database.paintColors.delete(paintId);
  }

  async listMixNotes(projectId: ProjectId): Promise<PaintMixNote[]> {
    const records = await database.paintMixNotes.where("projectId").equals(projectId).toArray();
    return records.map((record) => paintMixNoteSchema.parse(record));
  }

  async saveMixNote(note: PaintMixNote): Promise<void> {
    await database.paintMixNotes.put(paintMixNoteSchema.parse(note));
  }

  async deleteMixNote(projectId: ProjectId, targetHex: string): Promise<void> {
    await database.paintMixNotes
      .where("[projectId+targetHex]")
      .equals([projectId, targetHex.toUpperCase()])
      .delete();
  }
}

export const paintPlanningRepository = new PaintPlanningRepository();
