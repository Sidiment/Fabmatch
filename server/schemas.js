/**
 * Request body shapes. zod checks types and hard size caps; the shared validators in
 * ../shared/validators.js then apply the field rules with the same messages as the browser.
 */
import { z } from 'zod';
import { LIMITS } from '../shared/validators.js';
import { DEFAULT_ROLE } from '../shared/roles.js';

const MAX_LOTS_PER_PROJECT = 500;
const LOT_ID = z.string().max(32);
const textField = (max, label) => z.string({ error: `Enter the ${label}.` }).max(max, `Keep the ${label} to ${max} characters.`);

export const signInSchema = z.object({
  email: textField(LIMITS.email, 'email address'),
  password: textField(LIMITS.passwordMax, 'password'),
});

export const registrationSchema = z.object({
  name: textField(LIMITS.name, 'name'),
  email: textField(LIMITS.email, 'email address'),
  password: textField(LIMITS.passwordMax, 'password'),
  role: z.string().max(40).optional().default(DEFAULT_ROLE),
});

export const projectDetailsSchema = z.object({
  name: z.string().max(LIMITS.projectName, `Keep the project name to ${LIMITS.projectName} characters.`),
  lotIds: z.array(LOT_ID).max(MAX_LOTS_PER_PROJECT, `A project holds up to ${MAX_LOTS_PER_PROJECT} lots.`),
});

const optionalText = (max) => z.union([z.string().max(max), z.number()]).optional().transform((v) => (v === undefined ? '' : String(v)));

export const messageSchema = z.object({
  lotId: LOT_ID,
  project: optionalText(LIMITS.projectName + 50),
  quantity: optionalText(20),
  note: optionalText(LIMITS.note + 50),
  neededBy: optionalText(40),
});

export const contactSchema = z.object({
  name: optionalText(LIMITS.name + 50),
  email: optionalText(LIMITS.email + 50),
  message: optionalText(LIMITS.contactMessage + 50),
});
