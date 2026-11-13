DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_votes;
  END IF;
END
$$;
