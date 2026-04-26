import { Suspense } from 'react'
import ProfileTable from './components/ProfileTable'

export default function Home() {
  return (
    <Suspense>
      <ProfileTable />
    </Suspense>
  )
}
