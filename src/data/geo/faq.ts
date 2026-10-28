export const workflowFaq: Record<string, { question: string; answer: string }[]> = {
  'connecter-demandes-crm': [
    { question: 'Peut-on garder le formulaire et le CRM actuels ?', answer: 'Nous vérifions leurs API, leurs exports et leurs droits d’accès. Une connexion n’est confirmée qu’après ces vérifications ; remplacer les outils n’est pas automatique.' },
    { question: 'Comment éviter qu’une demande crée deux fiches ?', answer: 'Un identifiant stable permet de reconnaître une nouvelle tentative. Le test doit vérifier le résultat après un double envoi et après une panne, sans écraser une autre demande du même contact.' },
  ],
  'assistant-ia-interne-entreprise': [
    { question: 'Qui doit valider les sources de l’assistant ?', answer: 'Votre entreprise désigne le responsable des documents et des droits d’accès. Flex-Web met en œuvre le périmètre convenu ; une source contradictoire ou obsolète doit être clarifiée avant de servir de référence.' },
    { question: 'L’assistant garantit-il une réponse correcte ?', answer: 'Non. Les sources consultables, les tests et le contrôle humain aident à repérer les erreurs. Une question sans source fiable ou une décision engageante doit être transmise à une personne.' },
  ],
  'relance-devis': [
    { question: 'Toutes les relances doivent-elles partir automatiquement ?', answer: 'Non. Le premier parcours peut créer une tâche ou un brouillon à valider. L’envoi automatique exige des statuts fiables et des conditions d’arrêt explicitement définies avec votre entreprise.' },
    { question: 'Une relance automatisée garantit-elle plus de devis signés ?', answer: 'Non. Elle organise le suivi. L’acceptation dépend aussi de l’offre et du besoin du client. Aucun gain commercial ne peut être garanti par ce seul parcours.' },
  ],
};
