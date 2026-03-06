import { redirect } from 'next/navigation'

/**
 * /admin — redirect to /admin/tenants by default
 */
export default function AdminRootPage() {
    redirect('/admin/tenants')
}
