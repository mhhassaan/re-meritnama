-- Training Reviews carry more than one number.
--
-- The original's hospital profile asks for an overall star rating and then,
-- optionally, three aspects — teaching quality, work-life balance, seniors'
-- support — plus the year the reviewer trained. Those are the columns below.
--
-- They live on `community_posts` rather than in a new table, because a hospital
-- review already IS a community post: same authorship trigger, same rate limit,
-- same reporting, same moderation, same "hidden stays visible to its author".
-- A separate table would be a second copy of all of it, and the first place a
-- moderation rule would drift out of agreement with itself.
--
-- Every one is null unless the post is a review. A teaching score attached to a
-- question is a number with nothing to score, the same reason `rating` already
-- carries that constraint.
alter table public.community_posts
  add column rating_teaching smallint check (rating_teaching between 1 and 5),
  add column rating_balance smallint check (rating_balance between 1 and 5),
  add column rating_seniors smallint check (rating_seniors between 1 and 5),
  -- Free-ish, but bounded: "when did you train here" is only useful if it can
  -- be compared, and a text box would produce "2023", "23", "last year".
  add column training_year smallint check (training_year between 1990 and 2100);

alter table public.community_posts
  add constraint community_posts_aspects_are_reviews check (
    kind = 'hospital_review'
    or (
      rating_teaching is null
      and rating_balance is null
      and rating_seniors is null
      and training_year is null
    )
  );

-- Reading every review for one hospital is the query the profile page runs.
create index community_posts_hospital_review_idx
  on public.community_posts (hospital, created_at desc)
  where kind = 'hospital_review' and hidden_at is null;

comment on column public.community_posts.rating_teaching is
  'Hospital reviews only. Null on every other kind, enforced by check constraint.';
