export type Selo = 'proof_of_capture'|'edited'|'assisted_ai'|'generated_ai'|'remix'|'unknown';
export const classify = async () : Promise<Selo> => 'unknown';
