# Leave Household Confirmation Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an intermediate confirmation page + success/error page to the email-triggered "leave household" and "cancel leave request" flows, fully localized into all 42 supported languages.

**Architecture:** Email links switch from `${API}/api/members/(confirm|cancel)-leave?token=X` to `${APP}/leave-household?token=X&mode=confirm|cancel`. A new public Expo Router page drives a loading → confirm → success|error state machine, calling three new public API endpoints (all token-authenticated, no session). Legacy email URLs 302 to the new web URL so in-flight emails keep working.

**Tech Stack:** Hono (API), Prisma, Expo Router v6, React Native + react-native-web, i18next.

**Spec:** [docs/superpowers/specs/2026-04-18-leave-household-confirmation-page-design.md](../specs/2026-04-18-leave-household-confirmation-page-design.md)

---

## Rollout strategy

Two commits, pushed in sequence. Web deploys first — the new page is inert while no emails point at it — then the API change ships in a second commit. This avoids the ~1 min parallel-deploy window where the API could redirect to a page that doesn't exist yet.

Commit 1 = Phase 1 (Tasks 1–6).
Commit 2 = Phase 2 (Tasks 7–12).

---

## Phase 1 — Frontend + i18n

### Task 1: Add the `leaveHouseholdPage` namespace to `en.json`

**Files:**
- Modify: `apps/mobile/i18n/en.json`

- [ ] **Step 1: Open `apps/mobile/i18n/en.json` and insert a new top-level `leaveHouseholdPage` namespace before the closing `}` of the root object.**

Insert this block as a sibling of the existing top-level namespaces (e.g. after the `tabs` namespace near the end of the file — the exact position doesn't matter as long as it's a sibling of `common`, `auth`, etc.):

```json
  "leaveHouseholdPage": {
    "title": "Leave Household",
    "loading": "Loading…",
    "confirmLeave": {
      "heading": "Leave {{household}}?",
      "body": "You're about to leave this household. You'll lose access to all shared data.",
      "warning": "This cannot be undone. If you're the last member, the household and all its shared data will be deleted.",
      "primary": "Yes, leave household"
    },
    "confirmCancel": {
      "heading": "Cancel your request to leave {{household}}?",
      "body": "Your leave request will be cancelled and you'll stay in the household.",
      "primary": "Yes, cancel request"
    },
    "secondary": "Go back",
    "success": {
      "leave": {
        "heading": "You've left {{household}}",
        "body": "You no longer have access to this household's shared data."
      },
      "cancel": {
        "heading": "Leave request cancelled",
        "body": "You're still a member of {{household}}."
      }
    },
    "error": {
      "missingToken": "This link is missing required information. Please use the button from the email.",
      "invalidToken": "This link is invalid.",
      "expired": "This link has expired. Please request a new one from the app.",
      "alreadyConfirmed": "This request has already been confirmed.",
      "alreadyCancelled": "This request has already been cancelled.",
      "network": "We couldn't reach the server. Please try again."
    },
    "returnHome": "Back to Wohnly"
  }
```

- [ ] **Step 2: Validate JSON syntax**

Run: `npx --yes jsonlint-cli apps/mobile/i18n/en.json`
Expected: no errors, exit 0. If `jsonlint-cli` is not installed, fall back to: `node -e "JSON.parse(require('fs').readFileSync('apps/mobile/i18n/en.json','utf8'))"` — should produce no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/i18n/en.json
git commit -m "i18n(en): add leaveHouseholdPage namespace for email-confirmation flow"
```

---

### Task 2: Add the `leaveHouseholdPage` namespace to `de.json`

**Files:**
- Modify: `apps/mobile/i18n/de.json`

- [ ] **Step 1: Insert the German translation as a sibling top-level namespace**

```json
  "leaveHouseholdPage": {
    "title": "Haushalt verlassen",
    "loading": "Wird geladen…",
    "confirmLeave": {
      "heading": "{{household}} verlassen?",
      "body": "Sie sind dabei, diesen Haushalt zu verlassen. Sie verlieren den Zugriff auf alle gemeinsamen Daten.",
      "warning": "Dies kann nicht rückgängig gemacht werden. Wenn Sie das letzte Mitglied sind, werden der Haushalt und alle gemeinsamen Daten gelöscht.",
      "primary": "Ja, Haushalt verlassen"
    },
    "confirmCancel": {
      "heading": "Antrag auf Verlassen von {{household}} abbrechen?",
      "body": "Ihr Antrag wird abgebrochen und Sie bleiben Mitglied des Haushalts.",
      "primary": "Ja, Antrag abbrechen"
    },
    "secondary": "Zurück",
    "success": {
      "leave": {
        "heading": "Sie haben {{household}} verlassen",
        "body": "Sie haben keinen Zugriff mehr auf die gemeinsamen Daten dieses Haushalts."
      },
      "cancel": {
        "heading": "Antrag abgebrochen",
        "body": "Sie sind weiterhin Mitglied von {{household}}."
      }
    },
    "error": {
      "missingToken": "Diesem Link fehlen erforderliche Informationen. Bitte verwenden Sie die Schaltfläche aus der E-Mail.",
      "invalidToken": "Dieser Link ist ungültig.",
      "expired": "Dieser Link ist abgelaufen. Bitte fordern Sie in der App einen neuen an.",
      "alreadyConfirmed": "Dieser Antrag wurde bereits bestätigt.",
      "alreadyCancelled": "Dieser Antrag wurde bereits abgebrochen.",
      "network": "Der Server ist nicht erreichbar. Bitte versuchen Sie es erneut."
    },
    "returnHome": "Zurück zu Wohnly"
  }
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/mobile/i18n/de.json','utf8'))"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/i18n/de.json
git commit -m "i18n(de): add leaveHouseholdPage namespace"
```

---

### Task 3: Add `leaveHouseholdPage` to the remaining 40 language files

**Files:**
- Modify: all of `apps/mobile/i18n/*.json` except `en.json` and `de.json`.

Each file gets the same shape as Task 1 but translated. Insert as a sibling top-level namespace. The full block per language is below. Validate JSON after each file.

- [ ] **Step 1: fr.json**

```json
  "leaveHouseholdPage": {
    "title": "Quitter le foyer",
    "loading": "Chargement…",
    "confirmLeave": {
      "heading": "Quitter {{household}} ?",
      "body": "Vous êtes sur le point de quitter ce foyer. Vous perdrez l'accès à toutes les données partagées.",
      "warning": "Cette action est irréversible. Si vous êtes le dernier membre, le foyer et toutes ses données partagées seront supprimés.",
      "primary": "Oui, quitter le foyer"
    },
    "confirmCancel": {
      "heading": "Annuler votre demande pour quitter {{household}} ?",
      "body": "Votre demande sera annulée et vous resterez dans le foyer.",
      "primary": "Oui, annuler la demande"
    },
    "secondary": "Retour",
    "success": {
      "leave": { "heading": "Vous avez quitté {{household}}", "body": "Vous n'avez plus accès aux données partagées de ce foyer." },
      "cancel": { "heading": "Demande annulée", "body": "Vous êtes toujours membre de {{household}}." }
    },
    "error": {
      "missingToken": "Ce lien est incomplet. Veuillez utiliser le bouton dans l'e-mail.",
      "invalidToken": "Ce lien est invalide.",
      "expired": "Ce lien a expiré. Veuillez en demander un nouveau depuis l'application.",
      "alreadyConfirmed": "Cette demande a déjà été confirmée.",
      "alreadyCancelled": "Cette demande a déjà été annulée.",
      "network": "Impossible de joindre le serveur. Veuillez réessayer."
    },
    "returnHome": "Retour à Wohnly"
  }
```

- [ ] **Step 2: es.json**

```json
  "leaveHouseholdPage": {
    "title": "Salir del hogar",
    "loading": "Cargando…",
    "confirmLeave": {
      "heading": "¿Salir de {{household}}?",
      "body": "Estás a punto de salir de este hogar. Perderás el acceso a todos los datos compartidos.",
      "warning": "Esta acción no se puede deshacer. Si eres el último miembro, el hogar y todos sus datos compartidos se eliminarán.",
      "primary": "Sí, salir del hogar"
    },
    "confirmCancel": {
      "heading": "¿Cancelar tu solicitud para salir de {{household}}?",
      "body": "Tu solicitud se cancelará y seguirás siendo miembro del hogar.",
      "primary": "Sí, cancelar solicitud"
    },
    "secondary": "Volver",
    "success": {
      "leave": { "heading": "Has salido de {{household}}", "body": "Ya no tienes acceso a los datos compartidos de este hogar." },
      "cancel": { "heading": "Solicitud cancelada", "body": "Sigues siendo miembro de {{household}}." }
    },
    "error": {
      "missingToken": "A este enlace le falta información. Usa el botón del correo electrónico.",
      "invalidToken": "Este enlace no es válido.",
      "expired": "Este enlace ha caducado. Solicita uno nuevo desde la aplicación.",
      "alreadyConfirmed": "Esta solicitud ya se ha confirmado.",
      "alreadyCancelled": "Esta solicitud ya se ha cancelado.",
      "network": "No se pudo conectar con el servidor. Inténtalo de nuevo."
    },
    "returnHome": "Volver a Wohnly"
  }
```

- [ ] **Step 3: pt.json**

```json
  "leaveHouseholdPage": {
    "title": "Sair do agregado",
    "loading": "A carregar…",
    "confirmLeave": {
      "heading": "Sair de {{household}}?",
      "body": "Está prestes a sair deste agregado. Perderá o acesso a todos os dados partilhados.",
      "warning": "Esta ação não pode ser anulada. Se for o último membro, o agregado e todos os dados partilhados serão eliminados.",
      "primary": "Sim, sair do agregado"
    },
    "confirmCancel": {
      "heading": "Cancelar o seu pedido para sair de {{household}}?",
      "body": "O seu pedido será cancelado e continuará a ser membro do agregado.",
      "primary": "Sim, cancelar pedido"
    },
    "secondary": "Voltar",
    "success": {
      "leave": { "heading": "Saiu de {{household}}", "body": "Já não tem acesso aos dados partilhados deste agregado." },
      "cancel": { "heading": "Pedido cancelado", "body": "Continua a ser membro de {{household}}." }
    },
    "error": {
      "missingToken": "Este link não tem informação suficiente. Use o botão do e-mail.",
      "invalidToken": "Este link é inválido.",
      "expired": "Este link expirou. Peça um novo na aplicação.",
      "alreadyConfirmed": "Este pedido já foi confirmado.",
      "alreadyCancelled": "Este pedido já foi cancelado.",
      "network": "Não foi possível contactar o servidor. Tente novamente."
    },
    "returnHome": "Voltar ao Wohnly"
  }
```

- [ ] **Step 4: it.json**

```json
  "leaveHouseholdPage": {
    "title": "Lascia la casa",
    "loading": "Caricamento…",
    "confirmLeave": {
      "heading": "Lasciare {{household}}?",
      "body": "Stai per lasciare questa casa. Perderai l'accesso a tutti i dati condivisi.",
      "warning": "Questa azione non può essere annullata. Se sei l'ultimo membro, la casa e tutti i suoi dati condivisi verranno eliminati.",
      "primary": "Sì, lascia la casa"
    },
    "confirmCancel": {
      "heading": "Annullare la richiesta di lasciare {{household}}?",
      "body": "La tua richiesta verrà annullata e resterai membro della casa.",
      "primary": "Sì, annulla richiesta"
    },
    "secondary": "Indietro",
    "success": {
      "leave": { "heading": "Hai lasciato {{household}}", "body": "Non hai più accesso ai dati condivisi di questa casa." },
      "cancel": { "heading": "Richiesta annullata", "body": "Sei ancora membro di {{household}}." }
    },
    "error": {
      "missingToken": "A questo link mancano informazioni. Usa il pulsante nell'e-mail.",
      "invalidToken": "Questo link non è valido.",
      "expired": "Questo link è scaduto. Richiedine uno nuovo dall'app.",
      "alreadyConfirmed": "Questa richiesta è già stata confermata.",
      "alreadyCancelled": "Questa richiesta è già stata annullata.",
      "network": "Impossibile contattare il server. Riprova."
    },
    "returnHome": "Torna a Wohnly"
  }
```

- [ ] **Step 5: nl.json**

```json
  "leaveHouseholdPage": {
    "title": "Huishouden verlaten",
    "loading": "Laden…",
    "confirmLeave": {
      "heading": "{{household}} verlaten?",
      "body": "Je staat op het punt dit huishouden te verlaten. Je verliest toegang tot alle gedeelde gegevens.",
      "warning": "Dit kan niet ongedaan worden gemaakt. Als je het laatste lid bent, worden het huishouden en alle gedeelde gegevens verwijderd.",
      "primary": "Ja, huishouden verlaten"
    },
    "confirmCancel": {
      "heading": "Je verzoek om {{household}} te verlaten annuleren?",
      "body": "Je verzoek wordt geannuleerd en je blijft lid van het huishouden.",
      "primary": "Ja, verzoek annuleren"
    },
    "secondary": "Terug",
    "success": {
      "leave": { "heading": "Je hebt {{household}} verlaten", "body": "Je hebt geen toegang meer tot de gedeelde gegevens van dit huishouden." },
      "cancel": { "heading": "Verzoek geannuleerd", "body": "Je bent nog steeds lid van {{household}}." }
    },
    "error": {
      "missingToken": "Deze link mist informatie. Gebruik de knop in de e-mail.",
      "invalidToken": "Deze link is ongeldig.",
      "expired": "Deze link is verlopen. Vraag een nieuwe aan in de app.",
      "alreadyConfirmed": "Dit verzoek is al bevestigd.",
      "alreadyCancelled": "Dit verzoek is al geannuleerd.",
      "network": "Kan de server niet bereiken. Probeer het opnieuw."
    },
    "returnHome": "Terug naar Wohnly"
  }
```

- [ ] **Step 6: pl.json**

```json
  "leaveHouseholdPage": {
    "title": "Opuść gospodarstwo",
    "loading": "Wczytywanie…",
    "confirmLeave": {
      "heading": "Opuścić {{household}}?",
      "body": "Zamierzasz opuścić to gospodarstwo. Stracisz dostęp do wszystkich wspólnych danych.",
      "warning": "Tej akcji nie można cofnąć. Jeśli jesteś ostatnim członkiem, gospodarstwo i wszystkie wspólne dane zostaną usunięte.",
      "primary": "Tak, opuść gospodarstwo"
    },
    "confirmCancel": {
      "heading": "Anulować prośbę o opuszczenie {{household}}?",
      "body": "Twoja prośba zostanie anulowana i pozostaniesz członkiem gospodarstwa.",
      "primary": "Tak, anuluj prośbę"
    },
    "secondary": "Wstecz",
    "success": {
      "leave": { "heading": "Opuściłeś {{household}}", "body": "Nie masz już dostępu do wspólnych danych tego gospodarstwa." },
      "cancel": { "heading": "Prośba anulowana", "body": "Nadal jesteś członkiem {{household}}." }
    },
    "error": {
      "missingToken": "Ten link nie zawiera wymaganych informacji. Użyj przycisku z wiadomości e-mail.",
      "invalidToken": "Ten link jest nieprawidłowy.",
      "expired": "Ten link wygasł. Poproś o nowy w aplikacji.",
      "alreadyConfirmed": "Ta prośba została już potwierdzona.",
      "alreadyCancelled": "Ta prośba została już anulowana.",
      "network": "Nie udało się połączyć z serwerem. Spróbuj ponownie."
    },
    "returnHome": "Powrót do Wohnly"
  }
```

- [ ] **Step 7: ro.json**

```json
  "leaveHouseholdPage": {
    "title": "Părăsește gospodăria",
    "loading": "Se încarcă…",
    "confirmLeave": {
      "heading": "Părăsești {{household}}?",
      "body": "Ești pe cale să părăsești această gospodărie. Vei pierde accesul la toate datele partajate.",
      "warning": "Această acțiune nu poate fi anulată. Dacă ești ultimul membru, gospodăria și toate datele partajate vor fi șterse.",
      "primary": "Da, părăsește gospodăria"
    },
    "confirmCancel": {
      "heading": "Anulezi cererea de a părăsi {{household}}?",
      "body": "Cererea ta va fi anulată și vei rămâne membru al gospodăriei.",
      "primary": "Da, anulează cererea"
    },
    "secondary": "Înapoi",
    "success": {
      "leave": { "heading": "Ai părăsit {{household}}", "body": "Nu mai ai acces la datele partajate ale acestei gospodării." },
      "cancel": { "heading": "Cerere anulată", "body": "Ești în continuare membru al {{household}}." }
    },
    "error": {
      "missingToken": "Acestui link îi lipsesc informații. Folosește butonul din e-mail.",
      "invalidToken": "Acest link nu este valid.",
      "expired": "Acest link a expirat. Solicită unul nou din aplicație.",
      "alreadyConfirmed": "Această cerere a fost deja confirmată.",
      "alreadyCancelled": "Această cerere a fost deja anulată.",
      "network": "Serverul nu poate fi contactat. Încearcă din nou."
    },
    "returnHome": "Înapoi la Wohnly"
  }
```

- [ ] **Step 8: hu.json**

```json
  "leaveHouseholdPage": {
    "title": "Háztartás elhagyása",
    "loading": "Betöltés…",
    "confirmLeave": {
      "heading": "Elhagyod a(z) {{household}}-t?",
      "body": "Épp elhagyod ezt a háztartást. Elveszíted a hozzáférést az összes megosztott adathoz.",
      "warning": "Ez a művelet nem vonható vissza. Ha te vagy az utolsó tag, a háztartás és minden megosztott adat törlődik.",
      "primary": "Igen, elhagyom a háztartást"
    },
    "confirmCancel": {
      "heading": "Visszavonod a(z) {{household}} elhagyására vonatkozó kérést?",
      "body": "A kérésed visszavonásra kerül, és továbbra is a háztartás tagja maradsz.",
      "primary": "Igen, kérés visszavonása"
    },
    "secondary": "Vissza",
    "success": {
      "leave": { "heading": "Elhagytad a(z) {{household}}-t", "body": "Nincs többé hozzáférésed a háztartás megosztott adataihoz." },
      "cancel": { "heading": "Kérés visszavonva", "body": "Továbbra is a(z) {{household}} tagja maradsz." }
    },
    "error": {
      "missingToken": "Ez a link hiányos. Használd az e-mailben lévő gombot.",
      "invalidToken": "Ez a link érvénytelen.",
      "expired": "Ez a link lejárt. Kérj egy újat az alkalmazásban.",
      "alreadyConfirmed": "Ezt a kérést már megerősítették.",
      "alreadyCancelled": "Ezt a kérést már visszavonták.",
      "network": "A szerver nem érhető el. Próbáld újra."
    },
    "returnHome": "Vissza a Wohnly-hoz"
  }
```

- [ ] **Step 9: bg.json**

```json
  "leaveHouseholdPage": {
    "title": "Напускане на домакинството",
    "loading": "Зареждане…",
    "confirmLeave": {
      "heading": "Да напуснете {{household}}?",
      "body": "На път сте да напуснете това домакинство. Ще загубите достъп до всички споделени данни.",
      "warning": "Това действие не може да бъде отменено. Ако сте последният член, домакинството и всички споделени данни ще бъдат изтрити.",
      "primary": "Да, напусни домакинството"
    },
    "confirmCancel": {
      "heading": "Да отмените заявката за напускане на {{household}}?",
      "body": "Заявката ви ще бъде отменена и ще останете член на домакинството.",
      "primary": "Да, отмени заявката"
    },
    "secondary": "Назад",
    "success": {
      "leave": { "heading": "Напуснахте {{household}}", "body": "Вече нямате достъп до споделените данни на това домакинство." },
      "cancel": { "heading": "Заявката е отменена", "body": "Все още сте член на {{household}}." }
    },
    "error": {
      "missingToken": "На тази връзка липсва информация. Използвайте бутона в имейла.",
      "invalidToken": "Тази връзка е невалидна.",
      "expired": "Тази връзка е изтекла. Поискайте нова от приложението.",
      "alreadyConfirmed": "Тази заявка вече е потвърдена.",
      "alreadyCancelled": "Тази заявка вече е отменена.",
      "network": "Сървърът не може да бъде достигнат. Опитайте отново."
    },
    "returnHome": "Обратно към Wohnly"
  }
```

- [ ] **Step 10: uk.json**

```json
  "leaveHouseholdPage": {
    "title": "Покинути домогосподарство",
    "loading": "Завантаження…",
    "confirmLeave": {
      "heading": "Покинути {{household}}?",
      "body": "Ви збираєтеся покинути це домогосподарство. Ви втратите доступ до всіх спільних даних.",
      "warning": "Цю дію неможливо скасувати. Якщо ви останній учасник, домогосподарство та всі спільні дані будуть видалені.",
      "primary": "Так, покинути домогосподарство"
    },
    "confirmCancel": {
      "heading": "Скасувати запит на вихід із {{household}}?",
      "body": "Ваш запит буде скасовано, і ви залишитеся учасником домогосподарства.",
      "primary": "Так, скасувати запит"
    },
    "secondary": "Назад",
    "success": {
      "leave": { "heading": "Ви покинули {{household}}", "body": "Ви більше не маєте доступу до спільних даних цього домогосподарства." },
      "cancel": { "heading": "Запит скасовано", "body": "Ви залишаєтеся учасником {{household}}." }
    },
    "error": {
      "missingToken": "У цьому посиланні бракує інформації. Скористайтеся кнопкою в електронному листі.",
      "invalidToken": "Це посилання недійсне.",
      "expired": "Термін дії посилання закінчився. Запитайте нове в застосунку.",
      "alreadyConfirmed": "Цей запит вже підтверджено.",
      "alreadyCancelled": "Цей запит вже скасовано.",
      "network": "Не вдалося зв'язатися із сервером. Спробуйте ще раз."
    },
    "returnHome": "Назад до Wohnly"
  }
```

- [ ] **Step 11: ru.json**

```json
  "leaveHouseholdPage": {
    "title": "Покинуть семью",
    "loading": "Загрузка…",
    "confirmLeave": {
      "heading": "Покинуть {{household}}?",
      "body": "Вы собираетесь покинуть эту семью. Вы потеряете доступ ко всем общим данным.",
      "warning": "Это действие нельзя отменить. Если вы последний участник, семья и все её общие данные будут удалены.",
      "primary": "Да, покинуть семью"
    },
    "confirmCancel": {
      "heading": "Отменить запрос на выход из {{household}}?",
      "body": "Ваш запрос будет отменён, и вы останетесь участником семьи.",
      "primary": "Да, отменить запрос"
    },
    "secondary": "Назад",
    "success": {
      "leave": { "heading": "Вы покинули {{household}}", "body": "У вас больше нет доступа к общим данным этой семьи." },
      "cancel": { "heading": "Запрос отменён", "body": "Вы по-прежнему участник {{household}}." }
    },
    "error": {
      "missingToken": "В этой ссылке не хватает данных. Используйте кнопку из письма.",
      "invalidToken": "Эта ссылка недействительна.",
      "expired": "Срок действия ссылки истёк. Запросите новую в приложении.",
      "alreadyConfirmed": "Этот запрос уже подтверждён.",
      "alreadyCancelled": "Этот запрос уже отменён.",
      "network": "Не удалось связаться с сервером. Повторите попытку."
    },
    "returnHome": "Назад в Wohnly"
  }
```

- [ ] **Step 12: nb.json**

```json
  "leaveHouseholdPage": {
    "title": "Forlat husstand",
    "loading": "Laster…",
    "confirmLeave": {
      "heading": "Forlate {{household}}?",
      "body": "Du er i ferd med å forlate denne husstanden. Du mister tilgang til alle delte data.",
      "warning": "Denne handlingen kan ikke angres. Hvis du er det siste medlemmet, slettes husstanden og alle delte data.",
      "primary": "Ja, forlat husstanden"
    },
    "confirmCancel": {
      "heading": "Avbryte forespørselen om å forlate {{household}}?",
      "body": "Forespørselen din avbrytes og du forblir medlem av husstanden.",
      "primary": "Ja, avbryt forespørselen"
    },
    "secondary": "Tilbake",
    "success": {
      "leave": { "heading": "Du har forlatt {{household}}", "body": "Du har ikke lenger tilgang til de delte dataene i denne husstanden." },
      "cancel": { "heading": "Forespørsel avbrutt", "body": "Du er fortsatt medlem av {{household}}." }
    },
    "error": {
      "missingToken": "Denne lenken mangler informasjon. Bruk knappen fra e-posten.",
      "invalidToken": "Denne lenken er ugyldig.",
      "expired": "Denne lenken er utløpt. Be om en ny fra appen.",
      "alreadyConfirmed": "Denne forespørselen er allerede bekreftet.",
      "alreadyCancelled": "Denne forespørselen er allerede avbrutt.",
      "network": "Kunne ikke nå serveren. Prøv igjen."
    },
    "returnHome": "Tilbake til Wohnly"
  }
```

- [ ] **Step 13: sv.json**

```json
  "leaveHouseholdPage": {
    "title": "Lämna hushåll",
    "loading": "Laddar…",
    "confirmLeave": {
      "heading": "Lämna {{household}}?",
      "body": "Du är på väg att lämna detta hushåll. Du förlorar åtkomst till all delad data.",
      "warning": "Den här åtgärden kan inte ångras. Om du är sista medlemmen raderas hushållet och all delad data.",
      "primary": "Ja, lämna hushållet"
    },
    "confirmCancel": {
      "heading": "Avbryta din begäran att lämna {{household}}?",
      "body": "Din begäran avbryts och du förblir medlem i hushållet.",
      "primary": "Ja, avbryt begäran"
    },
    "secondary": "Tillbaka",
    "success": {
      "leave": { "heading": "Du har lämnat {{household}}", "body": "Du har inte längre åtkomst till den delade datan i detta hushåll." },
      "cancel": { "heading": "Begäran avbruten", "body": "Du är fortfarande medlem i {{household}}." }
    },
    "error": {
      "missingToken": "Den här länken saknar information. Använd knappen från e-postmeddelandet.",
      "invalidToken": "Den här länken är ogiltig.",
      "expired": "Den här länken har gått ut. Begär en ny från appen.",
      "alreadyConfirmed": "Den här begäran har redan bekräftats.",
      "alreadyCancelled": "Den här begäran har redan avbrutits.",
      "network": "Kunde inte nå servern. Försök igen."
    },
    "returnHome": "Tillbaka till Wohnly"
  }
```

- [ ] **Step 14: fi.json**

```json
  "leaveHouseholdPage": {
    "title": "Poistu kotitaloudesta",
    "loading": "Ladataan…",
    "confirmLeave": {
      "heading": "Poistutko kotitaloudesta {{household}}?",
      "body": "Olet poistumassa tästä kotitaloudesta. Menetät pääsyn kaikkiin jaettuihin tietoihin.",
      "warning": "Tätä ei voi peruuttaa. Jos olet viimeinen jäsen, kotitalous ja kaikki jaetut tiedot poistetaan.",
      "primary": "Kyllä, poistu kotitaloudesta"
    },
    "confirmCancel": {
      "heading": "Peruutatko pyyntösi poistua kotitaloudesta {{household}}?",
      "body": "Pyyntösi peruutetaan ja pysyt kotitalouden jäsenenä.",
      "primary": "Kyllä, peruuta pyyntö"
    },
    "secondary": "Takaisin",
    "success": {
      "leave": { "heading": "Olet poistunut kotitaloudesta {{household}}", "body": "Sinulla ei ole enää pääsyä tämän kotitalouden jaettuihin tietoihin." },
      "cancel": { "heading": "Pyyntö peruutettu", "body": "Olet edelleen kotitalouden {{household}} jäsen." }
    },
    "error": {
      "missingToken": "Linkistä puuttuu tietoja. Käytä sähköpostin painiketta.",
      "invalidToken": "Tämä linkki on virheellinen.",
      "expired": "Linkki on vanhentunut. Pyydä uusi sovelluksesta.",
      "alreadyConfirmed": "Tämä pyyntö on jo vahvistettu.",
      "alreadyCancelled": "Tämä pyyntö on jo peruutettu.",
      "network": "Palvelimeen ei saatu yhteyttä. Yritä uudelleen."
    },
    "returnHome": "Takaisin Wohnlyyn"
  }
```

- [ ] **Step 15: da.json**

```json
  "leaveHouseholdPage": {
    "title": "Forlad husstand",
    "loading": "Indlæser…",
    "confirmLeave": {
      "heading": "Forlad {{household}}?",
      "body": "Du er ved at forlade denne husstand. Du mister adgang til alle delte data.",
      "warning": "Denne handling kan ikke fortrydes. Hvis du er det sidste medlem, slettes husstanden og alle delte data.",
      "primary": "Ja, forlad husstanden"
    },
    "confirmCancel": {
      "heading": "Annullér din anmodning om at forlade {{household}}?",
      "body": "Din anmodning annulleres, og du forbliver medlem af husstanden.",
      "primary": "Ja, annullér anmodning"
    },
    "secondary": "Tilbage",
    "success": {
      "leave": { "heading": "Du har forladt {{household}}", "body": "Du har ikke længere adgang til denne husstands delte data." },
      "cancel": { "heading": "Anmodning annulleret", "body": "Du er stadig medlem af {{household}}." }
    },
    "error": {
      "missingToken": "Dette link mangler oplysninger. Brug knappen i e-mailen.",
      "invalidToken": "Dette link er ugyldigt.",
      "expired": "Dette link er udløbet. Anmod om et nyt i appen.",
      "alreadyConfirmed": "Denne anmodning er allerede bekræftet.",
      "alreadyCancelled": "Denne anmodning er allerede annulleret.",
      "network": "Kunne ikke nå serveren. Prøv igen."
    },
    "returnHome": "Tilbage til Wohnly"
  }
```

- [ ] **Step 16: is.json**

```json
  "leaveHouseholdPage": {
    "title": "Yfirgefa heimili",
    "loading": "Hleð…",
    "confirmLeave": {
      "heading": "Yfirgefa {{household}}?",
      "body": "Þú ert að fara að yfirgefa þetta heimili. Þú missir aðgang að öllum sameiginlegum gögnum.",
      "warning": "Þessa aðgerð er ekki hægt að afturkalla. Ef þú ert síðasti meðlimurinn, þá verður heimilið og öll sameiginleg gögn eydd.",
      "primary": "Já, yfirgefa heimilið"
    },
    "confirmCancel": {
      "heading": "Hætta við beiðni um að yfirgefa {{household}}?",
      "body": "Beiðni þinni verður hætt og þú verður áfram meðlimur á heimilinu.",
      "primary": "Já, hætta við beiðni"
    },
    "secondary": "Til baka",
    "success": {
      "leave": { "heading": "Þú hefur yfirgefið {{household}}", "body": "Þú hefur ekki lengur aðgang að sameiginlegum gögnum þessa heimilis." },
      "cancel": { "heading": "Beiðni hætt við", "body": "Þú ert enn meðlimur í {{household}}." }
    },
    "error": {
      "missingToken": "Þennan tengil vantar upplýsingar. Notaðu hnappinn úr tölvupóstinum.",
      "invalidToken": "Þessi tengill er ógildur.",
      "expired": "Þessi tengill er útrunninn. Biddu um nýjan í appinu.",
      "alreadyConfirmed": "Þessi beiðni hefur þegar verið staðfest.",
      "alreadyCancelled": "Þessari beiðni hefur þegar verið hætt við.",
      "network": "Náði ekki sambandi við miðlara. Reyndu aftur."
    },
    "returnHome": "Til baka í Wohnly"
  }
```

- [ ] **Step 17: lt.json**

```json
  "leaveHouseholdPage": {
    "title": "Palikti namų ūkį",
    "loading": "Įkeliama…",
    "confirmLeave": {
      "heading": "Palikti {{household}}?",
      "body": "Jūs paliekate šį namų ūkį. Prarasite prieigą prie visų bendrinamų duomenų.",
      "warning": "Šio veiksmo atšaukti negalima. Jei esate paskutinis narys, namų ūkis ir visi bendrinami duomenys bus ištrinti.",
      "primary": "Taip, palikti namų ūkį"
    },
    "confirmCancel": {
      "heading": "Atšaukti prašymą palikti {{household}}?",
      "body": "Jūsų prašymas bus atšauktas ir liksite namų ūkio nariu.",
      "primary": "Taip, atšaukti prašymą"
    },
    "secondary": "Atgal",
    "success": {
      "leave": { "heading": "Palikote {{household}}", "body": "Nebeturite prieigos prie šio namų ūkio bendrinamų duomenų." },
      "cancel": { "heading": "Prašymas atšauktas", "body": "Jūs vis dar esate {{household}} narys." }
    },
    "error": {
      "missingToken": "Šioje nuorodoje trūksta informacijos. Naudokite el. laiške esantį mygtuką.",
      "invalidToken": "Ši nuoroda negalioja.",
      "expired": "Šios nuorodos galiojimas baigėsi. Paprašykite naujos programėlėje.",
      "alreadyConfirmed": "Šis prašymas jau patvirtintas.",
      "alreadyCancelled": "Šis prašymas jau atšauktas.",
      "network": "Nepavyko pasiekti serverio. Bandykite dar kartą."
    },
    "returnHome": "Grįžti į Wohnly"
  }
```

- [ ] **Step 18: lv.json**

```json
  "leaveHouseholdPage": {
    "title": "Pamest mājsaimniecību",
    "loading": "Ielādē…",
    "confirmLeave": {
      "heading": "Pamest {{household}}?",
      "body": "Jūs gatavojaties pamest šo mājsaimniecību. Jūs zaudēsiet piekļuvi visiem koplietotajiem datiem.",
      "warning": "Šo darbību nevar atsaukt. Ja esat pēdējais dalībnieks, mājsaimniecība un visi koplietotie dati tiks dzēsti.",
      "primary": "Jā, pamest mājsaimniecību"
    },
    "confirmCancel": {
      "heading": "Atcelt pieprasījumu pamest {{household}}?",
      "body": "Jūsu pieprasījums tiks atcelts un jūs paliksiet mājsaimniecības dalībnieks.",
      "primary": "Jā, atcelt pieprasījumu"
    },
    "secondary": "Atpakaļ",
    "success": {
      "leave": { "heading": "Esat pametis {{household}}", "body": "Jums vairs nav piekļuves šīs mājsaimniecības koplietotajiem datiem." },
      "cancel": { "heading": "Pieprasījums atcelts", "body": "Jūs joprojām esat {{household}} dalībnieks." }
    },
    "error": {
      "missingToken": "Šai saitei trūkst informācijas. Izmantojiet pogu no e-pasta.",
      "invalidToken": "Šī saite nav derīga.",
      "expired": "Šī saite ir beigusies. Pieprasiet jaunu lietotnē.",
      "alreadyConfirmed": "Šis pieprasījums jau ir apstiprināts.",
      "alreadyCancelled": "Šis pieprasījums jau ir atcelts.",
      "network": "Nevarēja sazināties ar serveri. Mēģiniet vēlreiz."
    },
    "returnHome": "Atpakaļ uz Wohnly"
  }
```

- [ ] **Step 19: et.json**

```json
  "leaveHouseholdPage": {
    "title": "Lahku leibkonnast",
    "loading": "Laadin…",
    "confirmLeave": {
      "heading": "Kas lahkud leibkonnast {{household}}?",
      "body": "Oled lahkumas sellest leibkonnast. Kaotad juurdepääsu kõikidele jagatud andmetele.",
      "warning": "Seda tegevust ei saa tagasi võtta. Kui oled viimane liige, kustutatakse leibkond ja kõik jagatud andmed.",
      "primary": "Jah, lahku leibkonnast"
    },
    "confirmCancel": {
      "heading": "Kas tühistad taotluse lahkuda leibkonnast {{household}}?",
      "body": "Taotlus tühistatakse ja jääd leibkonna liikmeks.",
      "primary": "Jah, tühista taotlus"
    },
    "secondary": "Tagasi",
    "success": {
      "leave": { "heading": "Lahkusid leibkonnast {{household}}", "body": "Sul ei ole enam juurdepääsu selle leibkonna jagatud andmetele." },
      "cancel": { "heading": "Taotlus tühistatud", "body": "Oled endiselt leibkonna {{household}} liige." }
    },
    "error": {
      "missingToken": "Sellel lingil on teavet puudu. Kasuta e-kirjas olevat nuppu.",
      "invalidToken": "See link on kehtetu.",
      "expired": "See link on aegunud. Palu rakenduses uus.",
      "alreadyConfirmed": "See taotlus on juba kinnitatud.",
      "alreadyCancelled": "See taotlus on juba tühistatud.",
      "network": "Serverini ei jõutud. Proovi uuesti."
    },
    "returnHome": "Tagasi Wohnly juurde"
  }
```

- [ ] **Step 20: hr.json**

```json
  "leaveHouseholdPage": {
    "title": "Napusti kućanstvo",
    "loading": "Učitavanje…",
    "confirmLeave": {
      "heading": "Napustiti {{household}}?",
      "body": "Upravo napuštate ovo kućanstvo. Izgubit ćete pristup svim zajedničkim podacima.",
      "warning": "Ova se radnja ne može poništiti. Ako ste posljednji član, kućanstvo i svi zajednički podaci bit će izbrisani.",
      "primary": "Da, napusti kućanstvo"
    },
    "confirmCancel": {
      "heading": "Otkazati zahtjev za napuštanjem {{household}}?",
      "body": "Vaš zahtjev bit će otkazan i ostajete član kućanstva.",
      "primary": "Da, otkaži zahtjev"
    },
    "secondary": "Natrag",
    "success": {
      "leave": { "heading": "Napustili ste {{household}}", "body": "Više nemate pristup zajedničkim podacima ovog kućanstva." },
      "cancel": { "heading": "Zahtjev otkazan", "body": "I dalje ste član {{household}}." }
    },
    "error": {
      "missingToken": "Ovoj poveznici nedostaju podaci. Koristite gumb iz e-pošte.",
      "invalidToken": "Ova poveznica nije valjana.",
      "expired": "Ova poveznica je istekla. Zatražite novu u aplikaciji.",
      "alreadyConfirmed": "Ovaj zahtjev je već potvrđen.",
      "alreadyCancelled": "Ovaj zahtjev je već otkazan.",
      "network": "Nije moguće spojiti se s poslužiteljem. Pokušajte ponovno."
    },
    "returnHome": "Natrag na Wohnly"
  }
```

- [ ] **Step 21: sr.json**

```json
  "leaveHouseholdPage": {
    "title": "Напусти домаћинство",
    "loading": "Учитавање…",
    "confirmLeave": {
      "heading": "Напустити {{household}}?",
      "body": "Управо напуштате ово домаћинство. Изгубићете приступ свим заједничким подацима.",
      "warning": "Ова радња се не може поништити. Ако сте последњи члан, домаћинство и сви заједнички подаци биће обрисани.",
      "primary": "Да, напусти домаћинство"
    },
    "confirmCancel": {
      "heading": "Отказати захтев за напуштање {{household}}?",
      "body": "Ваш захтев биће отказан и остајете члан домаћинства.",
      "primary": "Да, откажи захтев"
    },
    "secondary": "Назад",
    "success": {
      "leave": { "heading": "Напустили сте {{household}}", "body": "Више немате приступ заједничким подацима овог домаћинства." },
      "cancel": { "heading": "Захтев отказан", "body": "И даље сте члан {{household}}." }
    },
    "error": {
      "missingToken": "Овој вези недостају подаци. Користите дугме из е-поште.",
      "invalidToken": "Ова веза није важећа.",
      "expired": "Ова веза је истекла. Затражите нову у апликацији.",
      "alreadyConfirmed": "Овај захтев је већ потврђен.",
      "alreadyCancelled": "Овај захтев је већ отказан.",
      "network": "Није могуће контактирати сервер. Покушајте поново."
    },
    "returnHome": "Назад на Wohnly"
  }
```

- [ ] **Step 22: sl.json**

```json
  "leaveHouseholdPage": {
    "title": "Zapusti gospodinjstvo",
    "loading": "Nalaganje…",
    "confirmLeave": {
      "heading": "Zapustiti {{household}}?",
      "body": "Ravno zapuščate to gospodinjstvo. Izgubili boste dostop do vseh skupnih podatkov.",
      "warning": "Tega dejanja ni mogoče razveljaviti. Če ste zadnji član, bosta gospodinjstvo in vsi skupni podatki izbrisani.",
      "primary": "Da, zapusti gospodinjstvo"
    },
    "confirmCancel": {
      "heading": "Prekličete zahtevo za zapustitev {{household}}?",
      "body": "Vaša zahteva bo preklicana in ostanete član gospodinjstva.",
      "primary": "Da, prekliči zahtevo"
    },
    "secondary": "Nazaj",
    "success": {
      "leave": { "heading": "Zapustili ste {{household}}", "body": "Nimate več dostopa do skupnih podatkov tega gospodinjstva." },
      "cancel": { "heading": "Zahteva preklicana", "body": "Še vedno ste član gospodinjstva {{household}}." }
    },
    "error": {
      "missingToken": "Temu povezavi manjkajo podatki. Uporabite gumb iz e-pošte.",
      "invalidToken": "Ta povezava ni veljavna.",
      "expired": "Ta povezava je potekla. Zahtevajte novo v aplikaciji.",
      "alreadyConfirmed": "Ta zahteva je že potrjena.",
      "alreadyCancelled": "Ta zahteva je že preklicana.",
      "network": "Strežnika ni bilo mogoče doseči. Poskusite znova."
    },
    "returnHome": "Nazaj na Wohnly"
  }
```

- [ ] **Step 23: cs.json**

```json
  "leaveHouseholdPage": {
    "title": "Opustit domácnost",
    "loading": "Načítání…",
    "confirmLeave": {
      "heading": "Opustit {{household}}?",
      "body": "Chystáte se opustit tuto domácnost. Ztratíte přístup ke všem sdíleným datům.",
      "warning": "Tuto akci nelze vrátit. Pokud jste poslední člen, domácnost a všechna sdílená data budou smazána.",
      "primary": "Ano, opustit domácnost"
    },
    "confirmCancel": {
      "heading": "Zrušit žádost o opuštění {{household}}?",
      "body": "Vaše žádost bude zrušena a zůstanete členem domácnosti.",
      "primary": "Ano, zrušit žádost"
    },
    "secondary": "Zpět",
    "success": {
      "leave": { "heading": "Opustili jste {{household}}", "body": "Již nemáte přístup ke sdíleným datům této domácnosti." },
      "cancel": { "heading": "Žádost zrušena", "body": "Stále jste členem domácnosti {{household}}." }
    },
    "error": {
      "missingToken": "Tomuto odkazu chybí informace. Použijte tlačítko z e-mailu.",
      "invalidToken": "Tento odkaz je neplatný.",
      "expired": "Platnost tohoto odkazu vypršela. Vyžádejte si nový v aplikaci.",
      "alreadyConfirmed": "Tato žádost již byla potvrzena.",
      "alreadyCancelled": "Tato žádost již byla zrušena.",
      "network": "Nepodařilo se spojit se serverem. Zkuste to znovu."
    },
    "returnHome": "Zpět na Wohnly"
  }
```

- [ ] **Step 24: sk.json**

```json
  "leaveHouseholdPage": {
    "title": "Opustiť domácnosť",
    "loading": "Načítava sa…",
    "confirmLeave": {
      "heading": "Opustiť {{household}}?",
      "body": "Chystáte sa opustiť túto domácnosť. Stratíte prístup ku všetkým zdieľaným údajom.",
      "warning": "Túto akciu nemožno vrátiť späť. Ak ste posledný člen, domácnosť a všetky zdieľané údaje budú vymazané.",
      "primary": "Áno, opustiť domácnosť"
    },
    "confirmCancel": {
      "heading": "Zrušiť žiadosť o opustenie {{household}}?",
      "body": "Vaša žiadosť bude zrušená a zostanete členom domácnosti.",
      "primary": "Áno, zrušiť žiadosť"
    },
    "secondary": "Späť",
    "success": {
      "leave": { "heading": "Opustili ste {{household}}", "body": "Už nemáte prístup k zdieľaným údajom tejto domácnosti." },
      "cancel": { "heading": "Žiadosť zrušená", "body": "Stále ste členom domácnosti {{household}}." }
    },
    "error": {
      "missingToken": "Tomuto odkazu chýbajú informácie. Použite tlačidlo z e-mailu.",
      "invalidToken": "Tento odkaz je neplatný.",
      "expired": "Platnosť tohto odkazu uplynula. Vyžiadajte si nový v aplikácii.",
      "alreadyConfirmed": "Táto žiadosť už bola potvrdená.",
      "alreadyCancelled": "Táto žiadosť už bola zrušená.",
      "network": "Nepodarilo sa spojiť so serverom. Skúste to znova."
    },
    "returnHome": "Späť do Wohnly"
  }
```

- [ ] **Step 25: el.json**

```json
  "leaveHouseholdPage": {
    "title": "Αποχώρηση από νοικοκυριό",
    "loading": "Φόρτωση…",
    "confirmLeave": {
      "heading": "Αποχώρηση από το {{household}};",
      "body": "Πρόκειται να αποχωρήσετε από αυτό το νοικοκυριό. Θα χάσετε την πρόσβαση σε όλα τα κοινόχρηστα δεδομένα.",
      "warning": "Αυτή η ενέργεια δεν μπορεί να αναιρεθεί. Αν είστε το τελευταίο μέλος, το νοικοκυριό και όλα τα κοινόχρηστα δεδομένα θα διαγραφούν.",
      "primary": "Ναι, αποχώρηση από το νοικοκυριό"
    },
    "confirmCancel": {
      "heading": "Ακύρωση του αιτήματος αποχώρησης από το {{household}};",
      "body": "Το αίτημά σας θα ακυρωθεί και θα παραμείνετε μέλος του νοικοκυριού.",
      "primary": "Ναι, ακύρωση αιτήματος"
    },
    "secondary": "Πίσω",
    "success": {
      "leave": { "heading": "Αποχωρήσατε από το {{household}}", "body": "Δεν έχετε πλέον πρόσβαση στα κοινόχρηστα δεδομένα αυτού του νοικοκυριού." },
      "cancel": { "heading": "Αίτημα ακυρώθηκε", "body": "Παραμένετε μέλος του {{household}}." }
    },
    "error": {
      "missingToken": "Σε αυτόν τον σύνδεσμο λείπουν πληροφορίες. Χρησιμοποιήστε το κουμπί από το email.",
      "invalidToken": "Αυτός ο σύνδεσμος δεν είναι έγκυρος.",
      "expired": "Αυτός ο σύνδεσμος έχει λήξει. Ζητήστε έναν νέο από την εφαρμογή.",
      "alreadyConfirmed": "Αυτό το αίτημα έχει ήδη επιβεβαιωθεί.",
      "alreadyCancelled": "Αυτό το αίτημα έχει ήδη ακυρωθεί.",
      "network": "Δεν ήταν δυνατή η επικοινωνία με τον διακομιστή. Δοκιμάστε ξανά."
    },
    "returnHome": "Επιστροφή στο Wohnly"
  }
```

- [ ] **Step 26: tr.json**

```json
  "leaveHouseholdPage": {
    "title": "Evden ayrıl",
    "loading": "Yükleniyor…",
    "confirmLeave": {
      "heading": "{{household}} evinden ayrılmak istiyor musunuz?",
      "body": "Bu evden ayrılmak üzeresiniz. Paylaşılan tüm verilere erişiminizi kaybedeceksiniz.",
      "warning": "Bu işlem geri alınamaz. Son üye sizseniz, ev ve tüm paylaşılan veriler silinir.",
      "primary": "Evet, evden ayrıl"
    },
    "confirmCancel": {
      "heading": "{{household}} evinden ayrılma isteğini iptal etmek istiyor musunuz?",
      "body": "İsteğiniz iptal edilecek ve evin üyesi olmaya devam edeceksiniz.",
      "primary": "Evet, isteği iptal et"
    },
    "secondary": "Geri",
    "success": {
      "leave": { "heading": "{{household}} evinden ayrıldınız", "body": "Artık bu evin paylaşılan verilerine erişiminiz yok." },
      "cancel": { "heading": "İstek iptal edildi", "body": "Hâlâ {{household}} evinin üyesisiniz." }
    },
    "error": {
      "missingToken": "Bu bağlantıda bilgi eksik. E-postadaki düğmeyi kullanın.",
      "invalidToken": "Bu bağlantı geçersiz.",
      "expired": "Bu bağlantının süresi doldu. Uygulamadan yeni bir bağlantı isteyin.",
      "alreadyConfirmed": "Bu istek zaten onaylanmış.",
      "alreadyCancelled": "Bu istek zaten iptal edilmiş.",
      "network": "Sunucuya ulaşılamadı. Lütfen tekrar deneyin."
    },
    "returnHome": "Wohnly'e dön"
  }
```

- [ ] **Step 27: zh.json**

```json
  "leaveHouseholdPage": {
    "title": "离开家庭",
    "loading": "加载中…",
    "confirmLeave": {
      "heading": "要离开 {{household}} 吗？",
      "body": "您即将离开此家庭。您将失去所有共享数据的访问权限。",
      "warning": "此操作无法撤销。如果您是最后一名成员，家庭及其所有共享数据将被删除。",
      "primary": "是，离开家庭"
    },
    "confirmCancel": {
      "heading": "取消离开 {{household}} 的请求？",
      "body": "您的请求将被取消，您将继续保留在家庭中。",
      "primary": "是，取消请求"
    },
    "secondary": "返回",
    "success": {
      "leave": { "heading": "您已离开 {{household}}", "body": "您将无法再访问此家庭的共享数据。" },
      "cancel": { "heading": "请求已取消", "body": "您仍然是 {{household}} 的成员。" }
    },
    "error": {
      "missingToken": "此链接缺少必需信息。请使用邮件中的按钮。",
      "invalidToken": "此链接无效。",
      "expired": "此链接已过期。请在应用中重新申请。",
      "alreadyConfirmed": "此请求已确认。",
      "alreadyCancelled": "此请求已取消。",
      "network": "无法连接到服务器。请重试。"
    },
    "returnHome": "返回 Wohnly"
  }
```

- [ ] **Step 28: ja.json**

```json
  "leaveHouseholdPage": {
    "title": "世帯から退出",
    "loading": "読み込み中…",
    "confirmLeave": {
      "heading": "{{household}} から退出しますか？",
      "body": "この世帯から退出しようとしています。すべての共有データへのアクセスを失います。",
      "warning": "この操作は取り消せません。あなたが最後のメンバーの場合、世帯とすべての共有データが削除されます。",
      "primary": "はい、世帯から退出する"
    },
    "confirmCancel": {
      "heading": "{{household}} からの退出リクエストをキャンセルしますか？",
      "body": "リクエストはキャンセルされ、世帯のメンバーとして残ります。",
      "primary": "はい、リクエストをキャンセル"
    },
    "secondary": "戻る",
    "success": {
      "leave": { "heading": "{{household}} から退出しました", "body": "この世帯の共有データにアクセスできなくなりました。" },
      "cancel": { "heading": "リクエストをキャンセルしました", "body": "引き続き {{household}} のメンバーです。" }
    },
    "error": {
      "missingToken": "このリンクには情報が不足しています。メール内のボタンを使用してください。",
      "invalidToken": "このリンクは無効です。",
      "expired": "このリンクの有効期限が切れました。アプリから新しいリンクをリクエストしてください。",
      "alreadyConfirmed": "このリクエストはすでに確認済みです。",
      "alreadyCancelled": "このリクエストはすでにキャンセル済みです。",
      "network": "サーバーに接続できませんでした。もう一度お試しください。"
    },
    "returnHome": "Wohnly に戻る"
  }
```

- [ ] **Step 29: ko.json**

```json
  "leaveHouseholdPage": {
    "title": "가구 나가기",
    "loading": "불러오는 중…",
    "confirmLeave": {
      "heading": "{{household}}에서 나가시겠습니까?",
      "body": "이 가구에서 나가려고 합니다. 모든 공유 데이터에 대한 액세스 권한을 잃게 됩니다.",
      "warning": "이 작업은 취소할 수 없습니다. 마지막 구성원인 경우 가구와 모든 공유 데이터가 삭제됩니다.",
      "primary": "예, 가구 나가기"
    },
    "confirmCancel": {
      "heading": "{{household}}에서 나가기 요청을 취소하시겠습니까?",
      "body": "요청이 취소되고 가구의 구성원으로 남게 됩니다.",
      "primary": "예, 요청 취소"
    },
    "secondary": "뒤로",
    "success": {
      "leave": { "heading": "{{household}}에서 나갔습니다", "body": "더 이상 이 가구의 공유 데이터에 액세스할 수 없습니다." },
      "cancel": { "heading": "요청이 취소되었습니다", "body": "여전히 {{household}}의 구성원입니다." }
    },
    "error": {
      "missingToken": "이 링크에 필요한 정보가 없습니다. 이메일의 버튼을 사용하세요.",
      "invalidToken": "이 링크는 유효하지 않습니다.",
      "expired": "이 링크가 만료되었습니다. 앱에서 새로 요청하세요.",
      "alreadyConfirmed": "이 요청은 이미 확인되었습니다.",
      "alreadyCancelled": "이 요청은 이미 취소되었습니다.",
      "network": "서버에 연결할 수 없습니다. 다시 시도하세요."
    },
    "returnHome": "Wohnly로 돌아가기"
  }
```

- [ ] **Step 30: hi.json**

```json
  "leaveHouseholdPage": {
    "title": "घर छोड़ें",
    "loading": "लोड हो रहा है…",
    "confirmLeave": {
      "heading": "{{household}} छोड़ें?",
      "body": "आप यह घर छोड़ने वाले हैं। आप सभी साझा डेटा तक पहुँच खो देंगे।",
      "warning": "इस क्रिया को पूर्ववत नहीं किया जा सकता। यदि आप अंतिम सदस्य हैं, तो घर और सभी साझा डेटा हटा दिए जाएँगे।",
      "primary": "हाँ, घर छोड़ें"
    },
    "confirmCancel": {
      "heading": "{{household}} छोड़ने का अनुरोध रद्द करें?",
      "body": "आपका अनुरोध रद्द कर दिया जाएगा और आप घर के सदस्य बने रहेंगे।",
      "primary": "हाँ, अनुरोध रद्द करें"
    },
    "secondary": "वापस",
    "success": {
      "leave": { "heading": "आपने {{household}} छोड़ दिया", "body": "अब आपकी इस घर के साझा डेटा तक पहुँच नहीं है।" },
      "cancel": { "heading": "अनुरोध रद्द किया गया", "body": "आप अभी भी {{household}} के सदस्य हैं।" }
    },
    "error": {
      "missingToken": "इस लिंक में आवश्यक जानकारी नहीं है। ईमेल का बटन इस्तेमाल करें।",
      "invalidToken": "यह लिंक अमान्य है।",
      "expired": "इस लिंक की समय सीमा समाप्त हो गई है। ऐप से नया लिंक माँगें।",
      "alreadyConfirmed": "यह अनुरोध पहले ही पुष्टि किया जा चुका है।",
      "alreadyCancelled": "यह अनुरोध पहले ही रद्द किया जा चुका है।",
      "network": "सर्वर से संपर्क नहीं हो सका। फिर से प्रयास करें।"
    },
    "returnHome": "Wohnly पर वापस जाएँ"
  }
```

- [ ] **Step 31: th.json**

```json
  "leaveHouseholdPage": {
    "title": "ออกจากครัวเรือน",
    "loading": "กำลังโหลด…",
    "confirmLeave": {
      "heading": "ออกจาก {{household}} ใช่ไหม?",
      "body": "คุณกำลังจะออกจากครัวเรือนนี้ คุณจะสูญเสียสิทธิ์เข้าถึงข้อมูลที่แชร์ทั้งหมด",
      "warning": "การกระทำนี้ไม่สามารถยกเลิกได้ หากคุณเป็นสมาชิกคนสุดท้าย ครัวเรือนและข้อมูลที่แชร์ทั้งหมดจะถูกลบ",
      "primary": "ใช่ ออกจากครัวเรือน"
    },
    "confirmCancel": {
      "heading": "ยกเลิกคำขอออกจาก {{household}} ใช่ไหม?",
      "body": "คำขอของคุณจะถูกยกเลิกและคุณจะยังคงเป็นสมาชิกของครัวเรือน",
      "primary": "ใช่ ยกเลิกคำขอ"
    },
    "secondary": "ย้อนกลับ",
    "success": {
      "leave": { "heading": "คุณได้ออกจาก {{household}} แล้ว", "body": "คุณไม่สามารถเข้าถึงข้อมูลที่แชร์ของครัวเรือนนี้ได้อีกต่อไป" },
      "cancel": { "heading": "ยกเลิกคำขอแล้ว", "body": "คุณยังคงเป็นสมาชิกของ {{household}}" }
    },
    "error": {
      "missingToken": "ลิงก์นี้ขาดข้อมูลที่จำเป็น กรุณาใช้ปุ่มในอีเมล",
      "invalidToken": "ลิงก์นี้ไม่ถูกต้อง",
      "expired": "ลิงก์นี้หมดอายุแล้ว กรุณาขอใหม่จากแอป",
      "alreadyConfirmed": "คำขอนี้ได้รับการยืนยันแล้ว",
      "alreadyCancelled": "คำขอนี้ถูกยกเลิกแล้ว",
      "network": "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่"
    },
    "returnHome": "กลับไปที่ Wohnly"
  }
```

- [ ] **Step 32: vi.json**

```json
  "leaveHouseholdPage": {
    "title": "Rời khỏi hộ gia đình",
    "loading": "Đang tải…",
    "confirmLeave": {
      "heading": "Rời khỏi {{household}}?",
      "body": "Bạn sắp rời khỏi hộ gia đình này. Bạn sẽ mất quyền truy cập vào tất cả dữ liệu dùng chung.",
      "warning": "Hành động này không thể hoàn tác. Nếu bạn là thành viên cuối cùng, hộ gia đình và toàn bộ dữ liệu dùng chung sẽ bị xóa.",
      "primary": "Có, rời khỏi hộ gia đình"
    },
    "confirmCancel": {
      "heading": "Hủy yêu cầu rời khỏi {{household}}?",
      "body": "Yêu cầu của bạn sẽ bị hủy và bạn vẫn là thành viên của hộ gia đình.",
      "primary": "Có, hủy yêu cầu"
    },
    "secondary": "Quay lại",
    "success": {
      "leave": { "heading": "Bạn đã rời khỏi {{household}}", "body": "Bạn không còn quyền truy cập vào dữ liệu dùng chung của hộ gia đình này." },
      "cancel": { "heading": "Đã hủy yêu cầu", "body": "Bạn vẫn là thành viên của {{household}}." }
    },
    "error": {
      "missingToken": "Liên kết này thiếu thông tin. Hãy dùng nút trong email.",
      "invalidToken": "Liên kết này không hợp lệ.",
      "expired": "Liên kết này đã hết hạn. Hãy yêu cầu liên kết mới từ ứng dụng.",
      "alreadyConfirmed": "Yêu cầu này đã được xác nhận.",
      "alreadyCancelled": "Yêu cầu này đã bị hủy.",
      "network": "Không thể kết nối tới máy chủ. Vui lòng thử lại."
    },
    "returnHome": "Quay lại Wohnly"
  }
```

- [ ] **Step 33: id.json**

```json
  "leaveHouseholdPage": {
    "title": "Keluar dari rumah tangga",
    "loading": "Memuat…",
    "confirmLeave": {
      "heading": "Keluar dari {{household}}?",
      "body": "Anda akan keluar dari rumah tangga ini. Anda akan kehilangan akses ke semua data bersama.",
      "warning": "Tindakan ini tidak dapat dibatalkan. Jika Anda anggota terakhir, rumah tangga dan semua data bersama akan dihapus.",
      "primary": "Ya, keluar dari rumah tangga"
    },
    "confirmCancel": {
      "heading": "Batalkan permintaan untuk keluar dari {{household}}?",
      "body": "Permintaan Anda akan dibatalkan dan Anda tetap menjadi anggota rumah tangga.",
      "primary": "Ya, batalkan permintaan"
    },
    "secondary": "Kembali",
    "success": {
      "leave": { "heading": "Anda telah keluar dari {{household}}", "body": "Anda tidak lagi memiliki akses ke data bersama rumah tangga ini." },
      "cancel": { "heading": "Permintaan dibatalkan", "body": "Anda masih menjadi anggota {{household}}." }
    },
    "error": {
      "missingToken": "Tautan ini kekurangan informasi. Gunakan tombol dari email.",
      "invalidToken": "Tautan ini tidak valid.",
      "expired": "Tautan ini telah kedaluwarsa. Minta yang baru dari aplikasi.",
      "alreadyConfirmed": "Permintaan ini sudah dikonfirmasi.",
      "alreadyCancelled": "Permintaan ini sudah dibatalkan.",
      "network": "Tidak dapat menghubungi server. Silakan coba lagi."
    },
    "returnHome": "Kembali ke Wohnly"
  }
```

- [ ] **Step 34: bn.json**

```json
  "leaveHouseholdPage": {
    "title": "পরিবার ত্যাগ করুন",
    "loading": "লোড হচ্ছে…",
    "confirmLeave": {
      "heading": "{{household}} ছেড়ে দেবেন?",
      "body": "আপনি এই পরিবার ত্যাগ করতে যাচ্ছেন। আপনি সমস্ত শেয়ার করা ডেটার অ্যাক্সেস হারাবেন।",
      "warning": "এই কাজটি ফিরিয়ে আনা যাবে না। আপনি যদি শেষ সদস্য হন, পরিবার ও সমস্ত শেয়ার করা ডেটা মুছে ফেলা হবে।",
      "primary": "হ্যাঁ, পরিবার ছেড়ে দিন"
    },
    "confirmCancel": {
      "heading": "{{household}} ছেড়ে যাওয়ার অনুরোধ বাতিল করবেন?",
      "body": "আপনার অনুরোধ বাতিল হবে এবং আপনি পরিবারের সদস্য থাকবেন।",
      "primary": "হ্যাঁ, অনুরোধ বাতিল করুন"
    },
    "secondary": "ফিরে যান",
    "success": {
      "leave": { "heading": "আপনি {{household}} ছেড়ে দিয়েছেন", "body": "আপনি এই পরিবারের শেয়ার করা ডেটা আর অ্যাক্সেস করতে পারবেন না।" },
      "cancel": { "heading": "অনুরোধ বাতিল হয়েছে", "body": "আপনি এখনও {{household}}-এর সদস্য।" }
    },
    "error": {
      "missingToken": "এই লিঙ্কে প্রয়োজনীয় তথ্য নেই। ইমেইলের বোতাম ব্যবহার করুন।",
      "invalidToken": "এই লিঙ্কটি অবৈধ।",
      "expired": "এই লিঙ্কের মেয়াদ শেষ হয়ে গেছে। অ্যাপ থেকে নতুন লিঙ্ক অনুরোধ করুন।",
      "alreadyConfirmed": "এই অনুরোধটি ইতিমধ্যে নিশ্চিত হয়েছে।",
      "alreadyCancelled": "এই অনুরোধটি ইতিমধ্যে বাতিল হয়েছে।",
      "network": "সার্ভারে পৌঁছানো যায়নি। আবার চেষ্টা করুন।"
    },
    "returnHome": "Wohnly-তে ফিরুন"
  }
```

- [ ] **Step 35: ms.json**

```json
  "leaveHouseholdPage": {
    "title": "Tinggalkan isi rumah",
    "loading": "Memuatkan…",
    "confirmLeave": {
      "heading": "Tinggalkan {{household}}?",
      "body": "Anda akan meninggalkan isi rumah ini. Anda akan kehilangan akses kepada semua data yang dikongsi.",
      "warning": "Tindakan ini tidak boleh dibatalkan. Jika anda ahli terakhir, isi rumah dan semua data yang dikongsi akan dipadam.",
      "primary": "Ya, tinggalkan isi rumah"
    },
    "confirmCancel": {
      "heading": "Batalkan permintaan untuk meninggalkan {{household}}?",
      "body": "Permintaan anda akan dibatalkan dan anda kekal sebagai ahli isi rumah.",
      "primary": "Ya, batalkan permintaan"
    },
    "secondary": "Kembali",
    "success": {
      "leave": { "heading": "Anda telah meninggalkan {{household}}", "body": "Anda tidak lagi mempunyai akses kepada data yang dikongsi dalam isi rumah ini." },
      "cancel": { "heading": "Permintaan dibatalkan", "body": "Anda masih ahli {{household}}." }
    },
    "error": {
      "missingToken": "Pautan ini tiada maklumat yang diperlukan. Gunakan butang dalam e-mel.",
      "invalidToken": "Pautan ini tidak sah.",
      "expired": "Pautan ini telah tamat tempoh. Minta pautan baharu dari aplikasi.",
      "alreadyConfirmed": "Permintaan ini telah disahkan.",
      "alreadyCancelled": "Permintaan ini telah dibatalkan.",
      "network": "Tidak dapat menghubungi pelayan. Sila cuba lagi."
    },
    "returnHome": "Kembali ke Wohnly"
  }
```

- [ ] **Step 36: tl.json**

```json
  "leaveHouseholdPage": {
    "title": "Umalis sa sambahayan",
    "loading": "Naglo-load…",
    "confirmLeave": {
      "heading": "Umalis sa {{household}}?",
      "body": "Aalis ka na sa sambahayang ito. Mawawalan ka ng access sa lahat ng shared data.",
      "warning": "Ang pagkilos na ito ay hindi maibabalik. Kung ikaw ang huling miyembro, mabubura ang sambahayan at lahat ng shared data.",
      "primary": "Oo, umalis sa sambahayan"
    },
    "confirmCancel": {
      "heading": "Kanselahin ang kahilingan mong umalis sa {{household}}?",
      "body": "Ikakansela ang kahilingan mo at mananatili kang miyembro ng sambahayan.",
      "primary": "Oo, kanselahin ang kahilingan"
    },
    "secondary": "Bumalik",
    "success": {
      "leave": { "heading": "Umalis ka na sa {{household}}", "body": "Wala ka nang access sa shared data ng sambahayang ito." },
      "cancel": { "heading": "Kinansela ang kahilingan", "body": "Miyembro ka pa rin ng {{household}}." }
    },
    "error": {
      "missingToken": "Kulang ng impormasyon ang link na ito. Gamitin ang button mula sa email.",
      "invalidToken": "Hindi wasto ang link na ito.",
      "expired": "Nag-expire na ang link na ito. Humingi ng bago sa app.",
      "alreadyConfirmed": "Nakumpirma na ang kahilingan.",
      "alreadyCancelled": "Nakansela na ang kahilingan.",
      "network": "Hindi naabot ang server. Subukan ulit."
    },
    "returnHome": "Bumalik sa Wohnly"
  }
```

- [ ] **Step 37: sw.json**

```json
  "leaveHouseholdPage": {
    "title": "Ondoka kwenye kaya",
    "loading": "Inapakia…",
    "confirmLeave": {
      "heading": "Ondoka kwenye {{household}}?",
      "body": "Unakaribia kuondoka kwenye kaya hii. Utapoteza ufikiaji wa data yote iliyoshirikiwa.",
      "warning": "Kitendo hiki hakiwezi kutenduliwa. Ikiwa wewe ndiye mwanachama wa mwisho, kaya na data yote iliyoshirikiwa itafutwa.",
      "primary": "Ndiyo, ondoka kwenye kaya"
    },
    "confirmCancel": {
      "heading": "Ghairi ombi la kuondoka {{household}}?",
      "body": "Ombi lako litaghairiwa na utabaki mwanachama wa kaya.",
      "primary": "Ndiyo, ghairi ombi"
    },
    "secondary": "Rudi",
    "success": {
      "leave": { "heading": "Umeondoka kwenye {{household}}", "body": "Huwezi tena kufikia data iliyoshirikiwa ya kaya hii." },
      "cancel": { "heading": "Ombi limeghairiwa", "body": "Bado ni mwanachama wa {{household}}." }
    },
    "error": {
      "missingToken": "Kiungo hiki kinakosa maelezo. Tumia kitufe kwenye barua pepe.",
      "invalidToken": "Kiungo hiki si sahihi.",
      "expired": "Kiungo hiki kimeisha muda. Omba kipya kwenye programu.",
      "alreadyConfirmed": "Ombi hili tayari limethibitishwa.",
      "alreadyCancelled": "Ombi hili tayari limeghairiwa.",
      "network": "Seva haipatikani. Jaribu tena."
    },
    "returnHome": "Rudi Wohnly"
  }
```

- [ ] **Step 38: ta.json**

```json
  "leaveHouseholdPage": {
    "title": "குடும்பத்தை விட்டு வெளியேறு",
    "loading": "ஏற்றுகிறது…",
    "confirmLeave": {
      "heading": "{{household}} - இலிருந்து வெளியேற வேண்டுமா?",
      "body": "நீங்கள் இந்தக் குடும்பத்தை விட்டு வெளியேற உள்ளீர்கள். அனைத்து பகிர்ந்த தரவுக்கான அணுகலை இழப்பீர்கள்.",
      "warning": "இந்த செயலை மாற்ற முடியாது. நீங்கள் கடைசி உறுப்பினராக இருந்தால், குடும்பமும் அனைத்து பகிர்ந்த தரவுகளும் நீக்கப்படும்.",
      "primary": "ஆம், குடும்பத்தை விட்டு வெளியேறு"
    },
    "confirmCancel": {
      "heading": "{{household}} விட்டு வெளியேறும் கோரிக்கையை ரத்து செய்ய வேண்டுமா?",
      "body": "உங்கள் கோரிக்கை ரத்து செய்யப்படும் மற்றும் நீங்கள் குடும்ப உறுப்பினராக இருப்பீர்கள்.",
      "primary": "ஆம், கோரிக்கையை ரத்து செய்"
    },
    "secondary": "திரும்பு",
    "success": {
      "leave": { "heading": "நீங்கள் {{household}} - இலிருந்து வெளியேறினீர்கள்", "body": "இந்தக் குடும்பத்தின் பகிர்ந்த தரவுகளை அணுக முடியாது." },
      "cancel": { "heading": "கோரிக்கை ரத்து செய்யப்பட்டது", "body": "நீங்கள் இன்னும் {{household}} - இன் உறுப்பினராக இருக்கிறீர்கள்." }
    },
    "error": {
      "missingToken": "இந்தத் தொடுப்பில் தேவையான தகவல் இல்லை. மின்னஞ்சலில் உள்ள பொத்தானைப் பயன்படுத்துங்கள்.",
      "invalidToken": "இந்தத் தொடுப்பு தவறானது.",
      "expired": "இந்தத் தொடுப்பு காலாவதியானது. செயலியிலிருந்து புதியதைக் கோருங்கள்.",
      "alreadyConfirmed": "இந்தக் கோரிக்கை ஏற்கனவே உறுதிப்படுத்தப்பட்டுவிட்டது.",
      "alreadyCancelled": "இந்தக் கோரிக்கை ஏற்கனவே ரத்து செய்யப்பட்டுவிட்டது.",
      "network": "சேவையகத்தை அடைய முடியவில்லை. மீண்டும் முயற்சிக்கவும்."
    },
    "returnHome": "Wohnly க்கு திரும்பு"
  }
```

- [ ] **Step 39: te.json**

```json
  "leaveHouseholdPage": {
    "title": "కుటుంబం నుండి వెళ్లిపో",
    "loading": "లోడ్ అవుతోంది…",
    "confirmLeave": {
      "heading": "{{household}} నుండి వెళ్లిపోవాలా?",
      "body": "మీరు ఈ కుటుంబాన్ని వదిలి వెళ్లబోతున్నారు. షేర్ చేసిన మొత్తం డేటాకు మీకు యాక్సెస్ ఉండదు.",
      "warning": "ఈ చర్యను రద్దు చేయలేరు. మీరు చివరి సభ్యుడైతే, కుటుంబం మరియు షేర్ చేసిన మొత్తం డేటా తొలగించబడతాయి.",
      "primary": "అవును, కుటుంబాన్ని వదిలివేయి"
    },
    "confirmCancel": {
      "heading": "{{household}} నుండి వెళ్లే అభ్యర్థనను రద్దు చేయాలా?",
      "body": "మీ అభ్యర్థన రద్దు అవుతుంది మరియు మీరు కుటుంబ సభ్యునిగా కొనసాగుతారు.",
      "primary": "అవును, అభ్యర్థనను రద్దు చేయి"
    },
    "secondary": "వెనక్కి",
    "success": {
      "leave": { "heading": "మీరు {{household}} నుండి వెళ్లారు", "body": "ఈ కుటుంబం యొక్క షేర్ చేసిన డేటాకు మీకు ఇకపై యాక్సెస్ లేదు." },
      "cancel": { "heading": "అభ్యర్థన రద్దు చేయబడింది", "body": "మీరు ఇంకా {{household}} సభ్యులుగానే ఉన్నారు." }
    },
    "error": {
      "missingToken": "ఈ లింక్‌లో అవసరమైన సమాచారం లేదు. ఈమెయిల్‌లోని బటన్‌ను ఉపయోగించండి.",
      "invalidToken": "ఈ లింక్ చెల్లదు.",
      "expired": "ఈ లింక్ గడువు ముగిసింది. యాప్ నుండి కొత్తది అభ్యర్థించండి.",
      "alreadyConfirmed": "ఈ అభ్యర్థన ఇప్పటికే ధృవీకరించబడింది.",
      "alreadyCancelled": "ఈ అభ్యర్థన ఇప్పటికే రద్దు చేయబడింది.",
      "network": "సర్వర్‌ని చేరుకోలేకపోయాం. మళ్ళీ ప్రయత్నించండి."
    },
    "returnHome": "Wohnly కు తిరిగి వెళ్ళు"
  }
```

- [ ] **Step 40: mr.json**

```json
  "leaveHouseholdPage": {
    "title": "कुटुंबातून बाहेर पडा",
    "loading": "लोड होत आहे…",
    "confirmLeave": {
      "heading": "{{household}} सोडायचे का?",
      "body": "तुम्ही हे कुटुंब सोडणार आहात. तुम्ही सर्व सामायिक डेटामध्ये प्रवेश गमावाल.",
      "warning": "ही क्रिया पूर्ववत करता येणार नाही. तुम्ही शेवटचे सदस्य असाल, तर कुटुंब आणि सर्व सामायिक डेटा हटवला जाईल.",
      "primary": "होय, कुटुंब सोडा"
    },
    "confirmCancel": {
      "heading": "{{household}} सोडण्याची विनंती रद्द करायची का?",
      "body": "तुमची विनंती रद्द होईल आणि तुम्ही कुटुंबाचे सदस्य राहाल.",
      "primary": "होय, विनंती रद्द करा"
    },
    "secondary": "मागे",
    "success": {
      "leave": { "heading": "तुम्ही {{household}} सोडले", "body": "तुम्हाला आता या कुटुंबाच्या सामायिक डेटावर प्रवेश नाही." },
      "cancel": { "heading": "विनंती रद्द झाली", "body": "तुम्ही अजूनही {{household}} चे सदस्य आहात." }
    },
    "error": {
      "missingToken": "या दुव्यात आवश्यक माहिती नाही. ईमेलमधील बटण वापरा.",
      "invalidToken": "हा दुवा अवैध आहे.",
      "expired": "या दुव्याची मुदत संपली आहे. अॅपमधून नवीन मागवा.",
      "alreadyConfirmed": "ही विनंती आधीच पुष्टी केलेली आहे.",
      "alreadyCancelled": "ही विनंती आधीच रद्द केलेली आहे.",
      "network": "सर्व्हरशी संपर्क होऊ शकला नाही. पुन्हा प्रयत्न करा."
    },
    "returnHome": "Wohnly वर परत जा"
  }
```

- [ ] **Step 41: Validate every JSON file still parses**

Run:
```bash
for f in apps/mobile/i18n/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || echo "FAIL: $f"
done
```
Expected: no FAIL lines printed.

- [ ] **Step 42: Commit**

```bash
git add apps/mobile/i18n/*.json
git commit -m "i18n: add leaveHouseholdPage namespace for remaining 40 languages"
```

---

### Task 4: Create the public Expo Router page

**Files:**
- Create: `apps/mobile/app/leave-household.tsx`

- [ ] **Step 1: Create the file with this exact content**

```tsx
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Mode = "confirm" | "cancel";

type ApiError =
  | "missing_token"
  | "invalid_token"
  | "expired"
  | "already_confirmed"
  | "already_cancelled"
  | "network";

type State =
  | { kind: "loading" }
  | { kind: "ready"; householdName: string }
  | { kind: "submitting"; householdName: string }
  | { kind: "success"; householdName: string }
  | { kind: "error"; code: ApiError };

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "https://api.wohnly.app";

async function parseErrorCode(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: string };
    const raw = body?.error ?? "";
    if (raw === "invalid_token" || raw === "expired" || raw === "already_confirmed" || raw === "already_cancelled") {
      return raw;
    }
  } catch {
    /* fall through */
  }
  return "invalid_token";
}

export default function LeaveHouseholdScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const params = useLocalSearchParams<{ token?: string; mode?: string; error?: string }>();

  const token = typeof params.token === "string" ? params.token : undefined;
  const mode: Mode = params.mode === "cancel" ? "cancel" : "confirm";

  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (params.error === "missing_token") {
      setState({ kind: "error", code: "missing_token" });
      return;
    }
    if (!token) {
      setState({ kind: "error", code: "missing_token" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/members/leave-info?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error", code: await parseErrorCode(res) });
          return;
        }
        const data = (await res.json()) as { householdName: string };
        setState({ kind: "ready", householdName: data.householdName });
      } catch {
        if (!cancelled) setState({ kind: "error", code: "network" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, params.error]);

  const goHome = () => router.replace("/");

  const submit = async () => {
    if (state.kind !== "ready" || !token) return;
    setState({ kind: "submitting", householdName: state.householdName });
    try {
      const path = mode === "cancel" ? "/api/members/cancel-leave" : "/api/members/confirm-leave";
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setState({ kind: "error", code: await parseErrorCode(res) });
        return;
      }
      setState({ kind: "success", householdName: state.householdName });
    } catch {
      setState({ kind: "error", code: "network" });
    }
  };

  const header = (
    <Stack.Screen options={{ title: t("leaveHouseholdPage.title"), headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
  );

  const container = (children: React.ReactNode) => (
    <>
      {header}
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 24, maxWidth: 600, alignSelf: "center", width: "100%", minHeight: "100%", justifyContent: "center" }}
      >
        {children}
      </ScrollView>
    </>
  );

  if (state.kind === "loading") {
    return container(
      <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
        <ActivityIndicator color={colors.tint} />
        <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: 16 }}>{t("leaveHouseholdPage.loading")}</Text>
      </View>,
    );
  }

  if (state.kind === "error") {
    const message = t(`leaveHouseholdPage.error.${toCamel(state.code)}`);
    return container(
      <View>
        <Text style={{ fontSize: 48, color: colors.destructive, textAlign: "center", marginBottom: 16 }}>✕</Text>
        <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text, textAlign: "center", marginBottom: 12 }}>{t("leaveHouseholdPage.title")}</Text>
        <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 32 }}>{message}</Text>
        <Pressable onPress={goHome} style={{ backgroundColor: colors.tint, borderRadius: 10, padding: 16, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{t("leaveHouseholdPage.returnHome")}</Text>
        </Pressable>
      </View>,
    );
  }

  if (state.kind === "success") {
    const section = mode === "cancel" ? "cancel" : "leave";
    return container(
      <View>
        <Text style={{ fontSize: 48, color: colors.tint, textAlign: "center", marginBottom: 16 }}>✓</Text>
        <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text, textAlign: "center", marginBottom: 12 }}>
          {t(`leaveHouseholdPage.success.${section}.heading`, { household: state.householdName })}
        </Text>
        <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 32 }}>
          {t(`leaveHouseholdPage.success.${section}.body`, { household: state.householdName })}
        </Text>
        <Pressable onPress={goHome} style={{ backgroundColor: colors.tint, borderRadius: 10, padding: 16, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{t("leaveHouseholdPage.returnHome")}</Text>
        </Pressable>
      </View>,
    );
  }

  const section = mode === "cancel" ? "confirmCancel" : "confirmLeave";
  const submitting = state.kind === "submitting";

  return container(
    <View>
      <Text style={{ fontSize: 26, fontWeight: "bold", color: colors.text, marginBottom: 16, textAlign: "center" }}>
        {t(`leaveHouseholdPage.${section}.heading`, { household: state.householdName })}
      </Text>
      <Text style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginBottom: 16, textAlign: "center" }}>
        {t(`leaveHouseholdPage.${section}.body`)}
      </Text>
      {mode === "confirm" && (
        <View style={{ backgroundColor: colors.destructive + "15", borderLeftWidth: 4, borderLeftColor: colors.destructive, padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <Text style={{ fontSize: 14, color: colors.destructive }}>{t("leaveHouseholdPage.confirmLeave.warning")}</Text>
        </View>
      )}
      <Pressable
        onPress={submit}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: colors.destructive,
          borderRadius: 10,
          padding: 16,
          alignItems: "center" as const,
          opacity: submitting ? 0.7 : pressed ? 0.8 : 1,
          marginBottom: 12,
        })}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{t(`leaveHouseholdPage.${section}.primary`)}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={goHome}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: colors.muted,
          borderRadius: 10,
          padding: 16,
          alignItems: "center" as const,
          opacity: submitting ? 0.7 : pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>{t("leaveHouseholdPage.secondary")}</Text>
      </Pressable>
    </View>,
  );
}

function toCamel(code: ApiError): string {
  switch (code) {
    case "missing_token": return "missingToken";
    case "invalid_token": return "invalidToken";
    case "already_confirmed": return "alreadyConfirmed";
    case "already_cancelled": return "alreadyCancelled";
    case "expired": return "expired";
    case "network": return "network";
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json 2>&1 | grep -E "leave-household\.tsx"`
Expected: no output (no errors in the new file). Pre-existing errors in other files are fine.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/leave-household.tsx
git commit -m "feat(web): add leave-household confirmation/success page"
```

---

### Task 5: Local smoke test of the new page

**Files:** none modified — manual verification.

- [ ] **Step 1: Start the Expo web dev server**

Run: `npm run dev:mobile`

Wait for "Waiting on http://localhost:8081".

- [ ] **Step 2: Open each relevant URL in a browser and confirm the rendering**

| URL | Expected visible state |
|-----|------------------------|
| `http://localhost:8081/leave-household` | `error` with "missingToken" message (no token in URL). |
| `http://localhost:8081/leave-household?token=bogus&mode=confirm` | After the `/leave-info` call fails, `error` with "invalidToken" message. |
| `http://localhost:8081/leave-household?error=missing_token` | `error` with "missingToken" (shortcut path used by legacy redirects). |

Note: the `ready`/`success` states can't be exercised without a real token from the API; they're covered by the production smoke test in Task 12.

- [ ] **Step 3: Spot-check i18n**

In the browser devtools, run `localStorage.setItem('wohnly_user_language', 'de')` then reload. The error title should now read "Haushalt verlassen" and the error text should be in German. Repeat for `fr` and `ja` as a sanity check.

- [ ] **Step 4: Stop the dev server** (Ctrl+C).

- [ ] **Step 5: No commit needed for this task.**

---

### Task 6: Push Phase 1 and wait for web deploy

**Files:** none — deployment only.

- [ ] **Step 1: Push the three commits from Tasks 1–4**

```bash
git push origin main
```

- [ ] **Step 2: Watch the web deploy finish**

Run: `gh run watch $(gh run list --workflow "Deploy Web" --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status`
Expected: exit 0.

- [ ] **Step 3: Production sanity ping**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://wohnly.app/leave-household`
Expected: `200`.

---

## Phase 2 — API changes

### Task 7: Update email URL construction

**Files:**
- Modify: `apps/api/src/routes/members.ts:229-231`

- [ ] **Step 1: Replace the URL block**

Find (currently at approx. line 229):

```ts
  const apiUrl = process.env.BETTER_AUTH_URL || "http://localhost:3001";
  const confirmUrl = `${apiUrl}/api/members/confirm-leave?token=${confirmation.confirmToken}`;
  const cancelUrl = `${apiUrl}/api/members/cancel-leave?token=${confirmation.confirmToken}`;
```

Replace with:

```ts
  const appUrl = process.env.APP_URL || "https://wohnly.app";
  const confirmUrl = `${appUrl}/leave-household?token=${confirmation.confirmToken}&mode=confirm`;
  const cancelUrl = `${appUrl}/leave-household?token=${confirmation.confirmToken}&mode=cancel`;
```

- [ ] **Step 2: No commit yet — continue to Task 8.**

---

### Task 8: Add the `GET /leave-info` endpoint

**Files:**
- Modify: `apps/api/src/routes/members.ts` — add new handler above the existing `app.use("*", requireAuth)` line.

- [ ] **Step 1: Locate the existing public block in `members.ts`**

The existing public `app.get("/confirm-leave", …)` and `app.get("/cancel-leave", …)` were previously inserted before `app.use("*", requireAuth)`. Add the new `/leave-info` handler in the same public block, immediately after them.

- [ ] **Step 2: Insert this handler block**

```ts
app.get("/leave-info", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "missing_token" }, 400);

  const confirmation = await prisma.leaveConfirmation.findUnique({
    where: { confirmToken: token },
    include: { member: { include: { household: { select: { name: true } } } } },
  });

  if (!confirmation) return c.json({ error: "invalid_token" }, 404);
  if (confirmation.confirmedAt) return c.json({ error: "already_confirmed" }, 410);
  if (confirmation.cancelledAt) return c.json({ error: "already_cancelled" }, 410);
  if (confirmation.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

  return c.json({
    householdName: confirmation.member.household.name,
    expiresAt: confirmation.expiresAt.toISOString(),
  });
});
```

- [ ] **Step 3: No commit yet — continue to Task 9.**

---

### Task 9: Move `POST /confirm-leave` above `requireAuth`

**Files:**
- Modify: `apps/api/src/routes/members.ts`

- [ ] **Step 1: Cut the existing `POST /confirm-leave` handler block**

Find the current handler (starts with `// POST /api/members/confirm-leave - Confirm leave (from app)` comment; app.post block returning `{ success: true, message: "Successfully left household" }`). Remove it from its current location below `app.use("*", requireAuth)`.

- [ ] **Step 2: Paste it into the public block** (right after the new `/leave-info` handler from Task 8). Simplify the error shape while you're at it so it matches what the frontend expects:

```ts
app.post("/confirm-leave", async (c) => {
  const { token } = await c.req.json();
  if (!token) return c.json({ error: "missing_token" }, 400);

  const confirmation = await prisma.leaveConfirmation.findUnique({
    where: { confirmToken: token },
    include: { member: { include: { household: { include: { members: true } } } } },
  });

  if (!confirmation) return c.json({ error: "invalid_token" }, 404);
  if (confirmation.confirmedAt) return c.json({ error: "already_confirmed" }, 410);
  if (confirmation.cancelledAt) return c.json({ error: "already_cancelled" }, 410);
  if (confirmation.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

  const householdId = confirmation.member.householdId;
  const memberCount = confirmation.member.household.members.length;

  await executeLeaveTransaction(confirmation, householdId, memberCount);

  return c.json({ success: true });
});
```

- [ ] **Step 3: No commit yet — continue to Task 10.**

---

### Task 10: Add the `POST /cancel-leave` endpoint

**Files:**
- Modify: `apps/api/src/routes/members.ts` — add new handler in the public block.

- [ ] **Step 1: Insert this handler right after the relocated `POST /confirm-leave`**

```ts
app.post("/cancel-leave", async (c) => {
  const { token } = await c.req.json();
  if (!token) return c.json({ error: "missing_token" }, 400);

  const confirmation = await prisma.leaveConfirmation.findUnique({
    where: { confirmToken: token },
  });

  if (!confirmation) return c.json({ error: "invalid_token" }, 404);
  if (confirmation.confirmedAt) return c.json({ error: "already_confirmed" }, 410);
  if (confirmation.cancelledAt) return c.json({ error: "already_cancelled" }, 410);
  if (confirmation.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

  await prisma.leaveConfirmation.update({
    where: { id: confirmation.id },
    data: { cancelledAt: new Date() },
  });

  return c.json({ success: true });
});
```

- [ ] **Step 2: No commit yet — continue to Task 11.**

---

### Task 11: Convert legacy `GET` email-link handlers to 302 redirects

**Files:**
- Modify: `apps/api/src/routes/members.ts` — the existing public `app.get("/confirm-leave", …)` and `app.get("/cancel-leave", …)`.

- [ ] **Step 1: Replace the two GET handlers**

Delete their current bodies and replace with:

```ts
app.get("/confirm-leave", (c) => {
  const token = c.req.query("token");
  const appUrl = process.env.APP_URL || "https://wohnly.app";
  if (!token) return c.redirect(`${appUrl}/leave-household?error=missing_token`);
  return c.redirect(`${appUrl}/leave-household?token=${encodeURIComponent(token)}&mode=confirm`);
});

app.get("/cancel-leave", (c) => {
  const token = c.req.query("token");
  const appUrl = process.env.APP_URL || "https://wohnly.app";
  if (!token) return c.redirect(`${appUrl}/leave-household?error=missing_token`);
  return c.redirect(`${appUrl}/leave-household?token=${encodeURIComponent(token)}&mode=cancel`);
});
```

The `executeLeaveTransaction` function is no longer referenced by these GETs — but it is still used by the relocated `POST /confirm-leave`, so keep the function in the file unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "members.ts"`
Expected: no output (ignore pre-existing errors in `expenses.ts` / `finances.ts`).

- [ ] **Step 3: Commit and push**

```bash
git add apps/api/src/routes/members.ts
git commit -m "feat(api): public leave-info, public leave POST, legacy 302s

- New GET /api/members/leave-info returns household name for the confirmation page
- POST /confirm-leave moved above requireAuth (token is the auth)
- New POST /cancel-leave mirrors confirm-leave
- Legacy GET /confirm-leave and /cancel-leave 302 to APP_URL/leave-household
- Email URLs now point at APP_URL instead of BETTER_AUTH_URL"
git push origin main
```

- [ ] **Step 4: Wait for API deploy**

Run: `gh run watch $(gh run list --workflow "Deploy API" --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status`
Expected: exit 0.

---

## Phase 3 — Production smoke test

### Task 12: End-to-end verification

**Files:** none — manual verification on production.

- [ ] **Step 1: Create a throwaway household**

Open the app (on a test account). Create a household called "SpecTestHH" (or similar). Invite a second throwaway account, accept, then request a leave from that second account.

- [ ] **Step 2: Email arrives with new URL**

Inspect the email. Both the "Confirm & Leave Household" and "Cancel Request" buttons should point to `https://wohnly.app/leave-household?token=…&mode=(confirm|cancel)`.

- [ ] **Step 3: Cancel flow**

Click the Cancel button in the email → intermediate page shows "Cancel your request to leave SpecTestHH?" in the device language → click "Yes, cancel request" → success page shows "Leave request cancelled".

- [ ] **Step 4: Request a fresh leave, then confirm flow**

From the second account, request a leave again. Click the red "Confirm & Leave Household" button → intermediate page shows "Leave SpecTestHH?" + the warning box → click "Yes, leave household" → success page shows "You've left SpecTestHH" → click "Back to Wohnly" → home page loads.

- [ ] **Step 5: Verify the server state**

In Prisma Studio (`cd apps/api && npx prisma studio`), check the `HouseholdMember` table — the second account's row for SpecTestHH should be gone. The `LeaveConfirmation` row should have `confirmedAt` set.

- [ ] **Step 6: Repeat-click the same email link**

Click the confirm button from the already-used email a second time. Expected: intermediate page shows `alreadyConfirmed` error state.

- [ ] **Step 7: Verify locale fallback**

Switch the test account's device language to French in the Wohnly app settings. Trigger another leave request. Open the new email and click the link. The intermediate page text should be in French.

- [ ] **Step 8: Clean up**

Delete the throwaway household if it still exists. Remove the throwaway account.

---

## Self-review notes

- **Spec coverage**: every section in the spec (email URLs, frontend state machine, public API endpoints, legacy 302s, i18n, rollout, manual verification) has at least one task in this plan.
- **Error codes**: `missing_token | invalid_token | expired | already_confirmed | already_cancelled` are used consistently in the API responses and in the frontend `ApiError` union — no drift.
- **Deployment ordering**: Phase 1 (web) pushes in Task 6 and waits for web-deploy green before Phase 2 (API) pushes in Task 11. This removes the stale-email 404 window.
- **No test framework**: Validation is via manual smoke tests + TypeScript compilation, matching the project's existing convention (per `CLAUDE.md`).
