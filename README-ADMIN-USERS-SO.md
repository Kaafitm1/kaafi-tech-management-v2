# Kaafi Tech — Admin-ka oo abuura Users

Waxaan ku daray:
- Bogga Staff & Users: foomka abuurista akoon cusub.
- Admin-only API: abuura Supabase Auth user iyo `profiles` record.
- Admin-only API: beddela role-ka user hore.
- SQL migration: role values iyo profile RLS.

## Muhiim ka hor intaadan isticmaalin
1. **Ha ku darin `.env.local` ama `node_modules` ZIP-ka.** ZIP-kan si ula kac ah uguma jiro `.env.local`.
2. Ku dar `SUPABASE_SERVICE_ROLE_KEY` gudaha `.env.local` ee kombiyuutarkaaga. Furahani waa sir; waligiis ha ku bilaaban `NEXT_PUBLIC_`.
3. Hubi `NEXT_PUBLIC_SUPABASE_URL` iyo `NEXT_PUBLIC_SUPABASE_ANON_KEY` inay jiraan.
4. Marka hore kaydi backup-ka database-kaaga. Supabase SQL Editor ku socodsii `supabase/migrations/0002_admin_user_creation.sql` kaddib markaad dib u eegto policies-ka hadda jira.
5. Hubi in profile-kaaga hadda jira `role='admin'` yahay.
6. Ku dar faylasha ZIP-kan mashruucaaga adigoo isku daraya faylasha jira. Ha ku dul qorin `.env.local`.
7. Restart garee Next.js: jooji server-ka `Ctrl+C`, kadib `npm run dev`.

## Doorarka hadda la taageeray
- `admin`
- `registration_staff` (Staff / diiwaangelinta)
- `teacher`
- `finance_staff` (Accountant / maaliyad)
- `student`

Foomku wuxuu isticmaalaa email + password si login-ka hadda jira ee Supabase Auth ula shaqeeyo. Akoon la abuuro waxaa email-kiisa la xaqiijinayaa si uu u geli karo password login-ka. Password-ka si ammaan ah ugu gudbi isticmaalaha, kuna dhiirrigeli inuu beddelo.

## Xaddidaad amni oo muhiim ah
API-yada abuurista iyo beddelidda role-ka waxay hubiyaan in caller-ku Admin yahay. Si kastaba, migration-kan **ma beddelayo dhammaan RLS policies-ka** ee students, payments, attendance iyo jadwallada kale. Haddii aad rabto in qof walba yeesho rukhsado gaar ah oo dhab ahaan database-ku fuliyo, waa in policies-ka jadwal kasta loo qaabeeyaa role-ka iyo hawsha loo oggolaaday. Ha siin shaqaale cusub xog dhab ah ilaa taas la dhammeeyo.
