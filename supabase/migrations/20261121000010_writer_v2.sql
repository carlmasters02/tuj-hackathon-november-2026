-- Word-style writer: per-document settings (page setup, template, sources, comments, word goal),
-- encrypted like the title and content. Certificates keep the formatted document (without private
-- comments) so certified writing can be published with its formatting, tables and citations.
alter table public.documents add column if not exists meta_enc text;
alter table public.certificates add column if not exists doc_json jsonb;
-- both columns are covered by the existing table-level grants and RLS policies
