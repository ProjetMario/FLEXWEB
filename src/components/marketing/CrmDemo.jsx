import { CheckCircle2, FileText, MailCheck, MessageSquare, UserRoundPlus } from "lucide-react";
import { useState } from "react";

const steps = [
  { id: "demande", label: "Demande reçue", icon: UserRoundPlus, detail: "Une entreprise décrit son besoin, sa commune et son délai." },
  { id: "qualification", label: "Qualification", icon: MessageSquare, detail: "Le CRM repère les informations présentes et celles à compléter." },
  { id: "relance", label: "Relance", icon: MailCheck, detail: "Une réponse courte est préparée, puis validée avant envoi." },
  { id: "devis", label: "Devis", icon: FileText, detail: "Le périmètre, le prix TTC et la prochaine action sont rattachés au contact." },
  { id: "suivi", label: "Prochaine action", icon: CheckCircle2, detail: "Le tableau de bord affiche ce qui doit être traité aujourd’hui." },
];

export default function CrmDemo() {
  const [active, setActive] = useState(0);
  const current = steps[active];
  const Icon = current.icon;
  return (
    <div className="crm-demo" data-conversion-scope="crm-demo">
      <div className="crm-tabs" role="tablist" aria-label="Étapes du CRM">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          return <button key={step.id} role="tab" aria-selected={active === index} onClick={() => setActive(index)}><StepIcon aria-hidden="true" />{step.label}</button>;
        })}
      </div>
      <section className="crm-board" aria-live="polite">
        <div>
          <p className="crm-label">Dossier exemple</p>
          <h2>Expert Isolation</h2>
          <p>Demande de rappel pour mieux présenter l’activité en ligne et suivre les échanges commerciaux.</p>
        </div>
        <div className="crm-status">
          <Icon aria-hidden="true" />
          <h3>{current.label}</h3>
          <p>{current.detail}</p>
        </div>
        <ul>
          <li><span>Origine</span><strong>Formulaire site</strong></li>
          <li><span>Statut</span><strong>{current.label}</strong></li>
          <li><span>Canal</span><strong>E-mail ou téléphone</strong></li>
          <li><span>Action</span><strong>À valider par l’entreprise</strong></li>
        </ul>
      </section>
    </div>
  );
}

