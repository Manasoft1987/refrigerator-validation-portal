import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Clock, ShieldAlert } from "lucide-react";

/**
 * Shows a banner when the current user is not yet approved by admin.
 * Returns null for admins or approved users.
 */
export function PendingApprovalBanner() {
  const { user } = useAuth();
  const statusQ = trpc.companies.myMembershipStatus.useQuery(undefined, {
    enabled: !!user && user.role !== "admin",
  });

  if (!user || user.role === "admin") return null;
  if (statusQ.isLoading || !statusQ.data) return null;
  if (statusQ.data.isApproved) return null;

  const { isPending, pendingCompanies } = statusQ.data;

  return (
    <div className={`mx-6 mt-4 rounded-lg border px-4 py-3 flex items-start gap-3 text-sm ${
      isPending
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
    }`}>
      {isPending ? (
        <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
      ) : (
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
      )}
      <div>
        {isPending ? (
          <>
            <span className="font-semibold">Ожидание одобрения</span>
            {" — "}
            ваша заявка на вступление в компанию
            {pendingCompanies.length > 0 && (
              <> «<strong>{pendingCompanies.join(", ")}</strong>»</>
            )}{" "}
            рассматривается администратором. Создание организаций и протоколов будет доступно после одобрения.
          </>
        ) : (
          <>
            <span className="font-semibold">Доступ ограничен</span>
            {" — "}
            вы не состоите ни в одной компании. Обратитесь к администратору, чтобы вас добавили в компанию.
          </>
        )}
      </div>
    </div>
  );
}
