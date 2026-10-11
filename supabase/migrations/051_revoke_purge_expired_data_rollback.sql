-- Rollback van 051: herstelt de oorspronkelijke (te ruime) rechten.
grant execute on function public.purge_expired_data() to public;
grant execute on function public.purge_expired_data() to authenticated;
