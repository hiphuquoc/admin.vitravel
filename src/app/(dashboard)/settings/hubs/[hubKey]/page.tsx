import { LISTING_HUB_KEYS } from '@/lib/nav';
import ListingHubForm from './ListingHubForm';

export function generateStaticParams() {
  return LISTING_HUB_KEYS.map((hubKey) => ({ hubKey }));
}

export default function ListingHubPage() {
  return <ListingHubForm />;
}
