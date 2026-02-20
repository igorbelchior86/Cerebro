import { redirect } from '@/i18n/routing';

export default function Dashboard({ params: { locale } }: { params: { locale: string } }) {
  redirect({ href: '/triage/home', locale });
}
