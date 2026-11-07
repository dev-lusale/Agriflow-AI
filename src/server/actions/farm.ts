"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseInput, runAction } from "@/lib/action";
import { requireRole } from "@/lib/auth/session";
import { activitySchema, cropRecordSchema, farmSchema, fieldSchema, noteSchema, taskSchema } from "@/lib/validation/schemas";
import * as farms from "@/server/farms/service";
import { saveImage } from "@/server/storage/service";
import { prisma } from "@/lib/db";

const farmer = () => requireRole("FARMER");

export async function createFarmAction(fd: FormData) {
  let id = "";
  const res = await runAction(async () => {
    const actor = await farmer();
    const farm = await farms.createFarm(actor, parseInput(farmSchema, fd));
    const photo = fd.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const up = await saveImage(actor, photo, "FARM_PHOTO");
      await prisma.farm.update({ where: { id: farm.id }, data: { photoId: up.id } });
    }
    id = farm.id;
  }, "Farm created.");
  if (res.ok) redirect(`/farmer/farms/${id}`);
  return res;
}

export async function updateFarmAction(farmId: string, fd: FormData) {
  return runAction(async () => {
    await farms.updateFarm(await farmer(), farmId, parseInput(farmSchema, fd));
    revalidatePath(`/farmer/farms/${farmId}`);
  }, "Farm updated.");
}

export async function deleteFarmAction(farmId: string) {
  const res = await runAction(async () => farms.deleteFarm(await farmer(), farmId), "Farm deleted.");
  if (res.ok) redirect("/farmer/farms");
  return res;
}

export async function createFieldAction(fd: FormData) {
  return runAction(async () => {
    await farms.createField(await farmer(), parseInput(fieldSchema, fd));
    revalidatePath("/farmer", "layout");
  }, "Field added.");
}

export async function updateFieldAction(fieldId: string, fd: FormData) {
  return runAction(async () => {
    await farms.updateField(await farmer(), fieldId, parseInput(fieldSchema, fd));
    revalidatePath("/farmer", "layout");
  }, "Field updated.");
}

export async function deleteFieldAction(fieldId: string) {
  return runAction(async () => {
    await farms.deleteField(await farmer(), fieldId);
    revalidatePath("/farmer", "layout");
  }, "Field removed.");
}

export async function createCropRecordAction(fd: FormData) {
  return runAction(async () => {
    await farms.createCropRecord(await farmer(), parseInput(cropRecordSchema, fd));
    revalidatePath("/farmer", "layout");
  }, "Crop added.");
}

export async function updateCropRecordAction(id: string, fd: FormData) {
  return runAction(async () => {
    await farms.updateCropRecord(await farmer(), id, parseInput(cropRecordSchema, fd));
    revalidatePath("/farmer", "layout");
  }, "Crop record updated.");
}

export async function deleteCropRecordAction(id: string) {
  return runAction(async () => {
    await farms.deleteCropRecord(await farmer(), id);
    revalidatePath("/farmer", "layout");
  }, "Crop record deleted.");
}

export async function recordActivityAction(fd: FormData) {
  return runAction(async () => {
    await farms.recordActivity(await farmer(), parseInput(activitySchema, fd));
    revalidatePath("/farmer", "layout");
  }, "Activity recorded.");
}

export async function deleteActivityAction(id: string) {
  return runAction(async () => {
    await farms.deleteActivity(await farmer(), id);
    revalidatePath("/farmer", "layout");
  }, "Activity deleted.");
}

export async function createTaskAction(fd: FormData) {
  return runAction(async () => {
    await farms.createTask(await farmer(), parseInput(taskSchema, fd));
    revalidatePath("/farmer", "layout");
  }, "Task added to your calendar.");
}

export async function setTaskStatusAction(id: string, status: "PENDING" | "DONE" | "CANCELLED") {
  return runAction(async () => {
    await farms.setTaskStatus(await farmer(), id, status);
    revalidatePath("/farmer", "layout");
  }, status === "DONE" ? "Task completed." : "Task updated.");
}

export async function createNoteAction(fd: FormData) {
  return runAction(async () => {
    await farms.createNote(await farmer(), parseInput(noteSchema, fd));
    revalidatePath("/farmer", "layout");
  }, "Note saved.");
}

export async function deleteNoteAction(id: string) {
  return runAction(async () => {
    await farms.deleteNote(await farmer(), id);
    revalidatePath("/farmer", "layout");
  }, "Note deleted.");
}
