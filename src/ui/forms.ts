export function parseFormData(form: HTMLFormElement): Record<string, any> {
  const data: Record<string, any> = {};
  new FormData(form).forEach((val, key) => { data[key] = val.toString(); });
  return data;
}
