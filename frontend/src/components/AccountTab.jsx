import ProfileCard from './ProfileCard.jsx'
import PeopleCard from './PeopleCard.jsx'
import CommissionCard from './CommissionCard.jsx'
import PasswordCard from './PasswordCard.jsx'
import BillingTab from './BillingTab.jsx'

// Account tab — the client's home base: their info, people, commission, password, billing.
export default function AccountTab({ client, preview }) {
  return (
    <div>
      <ProfileCard client={client} preview={preview} />
      <PeopleCard preview={preview} />
      <CommissionCard client={client} preview={preview} />
      <PasswordCard preview={preview} />
      <BillingTab client={client} preview={preview} />
    </div>
  )
}
