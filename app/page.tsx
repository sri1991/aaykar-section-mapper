import { getData } from '@/lib/search'
import AaykarSetuApp from '@/components/TaxBridgeApp'

export default function Home() {
  const data = getData()
  return <AaykarSetuApp data={data} />
}
