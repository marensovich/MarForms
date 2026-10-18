-- Server bans with a term (ТЗ 4.8, #131): null = forever; past it the ban no longer applies.
ALTER TABLE ban_list ADD COLUMN expires_at TIMESTAMP;
