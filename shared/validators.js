/**
 * Form rules shared by the browser and the server, so both give the same field messages.
 * Each validator is pure and returns { errors: {field: message}, values } with trimmed values.
 */
import { ROLE_IDS } from './roles.js';

export const LIMITS = Object.freeze({
  name: 100,
  email: 254,
  passwordMin: 10,
  passwordMax: 200,
  projectName: 120,
  note: 2000,
  contactMessage: 4000,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MESSAGE = 'Enter an email address in the form name@example.com.';

const text = (value) => String(value ?? '').trim();
const tooLong = (value, max) => value.length > max;

function checkEmail(errors, email) {
  if (!email || !EMAIL_PATTERN.test(email) || tooLong(email, LIMITS.email)) errors.email = EMAIL_MESSAGE;
}

/** Ask the workroom. The quantity cannot exceed what is on hand: yards for a roll, pieces for sample pieces. */
export function validateAsk(values, lot) {
  const errors = {};
  const project = text(values.project);
  const quantity = text(values.quantity);
  const note = text(values.note);
  const neededBy = text(values.neededBy);

  if (!project) errors.project = 'Enter the project name so the workroom knows which project is asking.';
  else if (tooLong(project, LIMITS.projectName)) errors.project = `Keep the project name to ${LIMITS.projectName} characters.`;
  if (quantity) {
    const amount = Number(quantity);
    if (lot.kind === 'piece') {
      if (!Number.isInteger(amount) || amount <= 0) errors.quantity = 'Enter the quantity as a whole number of pieces.';
      else if (amount > lot.qty) errors.quantity = `Enter ${lot.qty} or fewer. This lot has ${lot.qty} ${lot.qty === 1 ? 'piece' : 'pieces'} on hand.`;
    } else if (!Number.isFinite(amount) || amount <= 0) errors.quantity = 'Enter the quantity as a number of yards.';
    else if (lot.yd !== null && lot.yd !== undefined && amount > lot.yd) errors.quantity = `Enter ${lot.yd} yd or less. This lot has ${lot.yd} yd on hand.`;
  }
  if (!note) errors.note = 'Enter a note so the workroom knows what to answer.';
  else if (tooLong(note, LIMITS.note)) errors.note = `Keep the note to ${LIMITS.note} characters.`;
  if (neededBy && Number.isNaN(new Date(neededBy).getTime())) errors.neededBy = 'Enter the needed-by date as a calendar date.';

  return { errors, values: { project, quantity, note, neededBy } };
}

export function validateContact(values) {
  const errors = {};
  const name = text(values.name);
  const email = text(values.email);
  const message = text(values.message);
  if (!name) errors.name = 'Enter a name so the reply can be addressed.';
  else if (tooLong(name, LIMITS.name)) errors.name = `Keep the name to ${LIMITS.name} characters.`;
  checkEmail(errors, email);
  if (!message) errors.message = 'Enter a message.';
  else if (tooLong(message, LIMITS.contactMessage)) errors.message = `Keep the message to ${LIMITS.contactMessage} characters.`;
  return { errors, values: { name, email, message } };
}

export function validateSignIn(values) {
  const errors = {};
  const email = text(values.email).toLowerCase();
  const password = String(values.password ?? '');
  checkEmail(errors, email);
  if (!password) errors.password = 'Enter the password.';
  return { errors, values: { email, password } };
}

export function validateRegistration(values) {
  const errors = {};
  const name = text(values.name);
  const email = text(values.email).toLowerCase();
  const password = String(values.password ?? '');
  const role = text(values.role);
  if (!name) errors.name = 'Enter a name for the account.';
  else if (tooLong(name, LIMITS.name)) errors.name = `Keep the name to ${LIMITS.name} characters.`;
  checkEmail(errors, email);
  if (password.length < LIMITS.passwordMin) errors.password = `Use at least ${LIMITS.passwordMin} characters for the password.`;
  else if (password.length > LIMITS.passwordMax) errors.password = `Keep the password to ${LIMITS.passwordMax} characters.`;
  if (!ROLE_IDS.includes(role)) errors.role = 'Choose the role that fits best.';
  return { errors, values: { name, email, password, role } };
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;
