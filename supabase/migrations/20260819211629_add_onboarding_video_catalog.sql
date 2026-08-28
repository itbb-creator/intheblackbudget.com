create table if not exists public.onboarding_videos (
  plan text primary key check (plan in ('essentials','complete','premium')),
  title text not null,
  vimeo_video_id text not null check (vimeo_video_id ~ '^[0-9]+$'),
  embed_url text not null,
  public_url text not null,
  onboarding_url text not null,
  guide_file_name text not null,
  aspect_ratio text not null check (aspect_ratio in ('16:9','4:3')),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.onboarding_videos enable row level security;
revoke all on table public.onboarding_videos from anon, authenticated;
grant select on table public.onboarding_videos to anon, authenticated;
grant all on table public.onboarding_videos to service_role;

drop policy if exists "Published onboarding videos are publicly readable" on public.onboarding_videos;
create policy "Published onboarding videos are publicly readable"
on public.onboarding_videos for select
to anon, authenticated
using (is_active = true);

insert into public.onboarding_videos (plan,title,vimeo_video_id,embed_url,public_url,onboarding_url,guide_file_name,aspect_ratio,is_active,updated_at)
values
('essentials','Pravely Essentials Onboarding','1219674330','https://player.vimeo.com/video/1219674330?badge=0&autopause=0&player_id=0&app_id=58479&dnt=1','https://vimeo.com/1219674330?share=copy&fl=sv&fe=ci','https://pravely.com/onboarding?plan=essentials','Pravely_Quick_Start_Guide_Essentials_Updated.pdf','16:9',true,now()),
('complete','Pravely Complete Onboarding','1219418665','https://player.vimeo.com/video/1219418665?badge=0&autopause=0&player_id=0&app_id=58479&dnt=1','https://vimeo.com/1219418665?share=copy&fl=sv&fe=ci','https://pravely.com/onboarding?plan=complete','Pravely_Quick_Start_Guide_Complete_Updated.pdf','4:3',true,now()),
('premium','Pravely Premium Onboarding','1219411827','https://player.vimeo.com/video/1219411827?badge=0&autopause=0&player_id=0&app_id=58479&dnt=1','https://vimeo.com/1219411827?share=copy','https://pravely.com/onboarding?plan=premium','Pravely_Quick_Start_Guide_Premium_Updated.pdf','16:9',true,now())
on conflict (plan) do update set
title=excluded.title,
vimeo_video_id=excluded.vimeo_video_id,
embed_url=excluded.embed_url,
public_url=excluded.public_url,
onboarding_url=excluded.onboarding_url,
guide_file_name=excluded.guide_file_name,
aspect_ratio=excluded.aspect_ratio,
is_active=excluded.is_active,
updated_at=now();;
