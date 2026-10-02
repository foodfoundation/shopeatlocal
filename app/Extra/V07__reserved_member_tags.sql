INSERT INTO MemberTags (Tag)
SELECT 'no coop fee' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM MemberTags WHERE LOWER(Tag) = 'no coop fee');

INSERT INTO MemberTags (Tag)
SELECT 'full coop fee' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM MemberTags WHERE LOWER(Tag) = 'full coop fee');
