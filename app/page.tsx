import { getData } from '@/lib/search'
import SectionMapper from '@/components/SectionMapper'

export default function Home() {
  const data = getData()
  return <SectionMapper data={data} />
}
