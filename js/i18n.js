/* ============================================================
   Kiteline — Internationalisation (i18n)
   UI string dictionaries + multilingual user manual.
   ============================================================ */
(function () {
  const LANG_KEY = 'kiteline.lang';

  const dict = {
    en: {
      'lang.name':'English',
      'nav.home':'Home','nav.wflive':'Happening Now','nav.wfdone':'Completed Today','nav.wfout':'Outstanding','nav.wfod':'Overdue','nav.wfstaff':'Staff Working','nav.wfdel':'Deliveries Today','nav.wfprod':'Food Production','nav.wfclean':'Cleaning Status','nav.wfhaccp':'HACCP Status','nav.wfperf':'Performance','nav.dashboard':'Dashboard','nav.taskoverview':'Task Overview','nav.deliveries':'Deliveries','nav.temps':'Temperatures','nav.alerts':'Alerts',
      'nav.haccp':'HACCP & Checklists','nav.records':'Records','nav.sites':'Sites',
      'nav.suppliers':'Suppliers','nav.incidents':'Incidents','nav.training':'Training','nav.maintenance':'Maintenance',
      'nav.cooling':'Cooling','nav.holding':'Hot & Cold Hold','nav.phlogs':'pH Monitor','nav.batches':'Batches','nav.assets':'Assets & Equipment',
      'nav.reports':'Reports','nav.team':'Team','nav.recipes':'Recipes','nav.foodcost':'Food Cost','nav.manual':'User Manual',
      'nav.allerq':'MenuGuard','nav.labels':'LabelSmart','nav.waste':'WasteWise','nav.settings':'Settings',
      'nav.products':'Products','nav.liveops':'Live Ops',
      'top.live':'Live','top.search':'Search or jump to… (Ctrl K)',
    },
    es: {
      'lang.name':'Español',
      'nav.home':'Inicio','nav.wflive':'En curso','nav.wfdone':'Completado hoy','nav.wfout':'Pendiente','nav.wfod':'Atrasado','nav.wfstaff':'Personal activo','nav.wfdel':'Entregas hoy','nav.wfprod':'Producción','nav.wfclean':'Limpieza','nav.wfhaccp':'Estado APPCC','nav.wfperf':'Rendimiento','nav.dashboard':'Panel','nav.taskoverview':'Resumen de Tareas','nav.deliveries':'Entregas','nav.temps':'Temperaturas','nav.alerts':'Alertas',
      'nav.haccp':'APPCC y Listas','nav.records':'Registros','nav.sites':'Sedes',
      'nav.suppliers':'Proveedores','nav.incidents':'Incidencias','nav.training':'Formación','nav.maintenance':'Mantenimiento',
      'nav.cooling':'Enfriamiento','nav.holding':'Mantenimiento de Temp.','nav.phlogs':'Monitor de pH','nav.batches':'Lotes','nav.assets':'Activos y Equipos',
      'nav.reports':'Informes','nav.team':'Equipo','nav.recipes':'Recetas','nav.foodcost':'Costo de Alimentos','nav.manual':'Manual de Usuario',
      'nav.allerq':'MenuGuard','nav.labels':'LabelSmart','nav.waste':'WasteWise','nav.settings':'Ajustes',
      'nav.products':'Productos','nav.liveops':'Operaciones en vivo',
      'top.live':'En vivo','top.search':'Buscar o ir a… (Ctrl K)',
    },
    fr: {
      'lang.name':'Français',
      'nav.home':'Accueil','nav.wflive':'En cours','nav.wfdone':'Terminé aujourd\'hui','nav.wfout':'En attente','nav.wfod':'En retard','nav.wfstaff':'Personnel actif','nav.wfdel':'Livraisons du jour','nav.wfprod':'Production','nav.wfclean':'Nettoyage','nav.wfhaccp':'Statut HACCP','nav.wfperf':'Performance','nav.dashboard':'Tableau de bord','nav.taskoverview':'Aperçu des Tâches','nav.deliveries':'Livraisons','nav.temps':'Températures','nav.alerts':'Alertes',
      'nav.haccp':'HACCP et Listes','nav.records':'Registres','nav.sites':'Sites',
      'nav.suppliers':'Fournisseurs','nav.incidents':'Incidents','nav.training':'Formation','nav.maintenance':'Maintenance',
      'nav.cooling':'Refroidissement','nav.holding':'Maintien chaud/froid','nav.phlogs':'Suivi du pH','nav.batches':'Lots','nav.assets':'Actifs et Équipements',
      'nav.reports':'Rapports','nav.team':'Équipe','nav.recipes':'Recettes','nav.foodcost':'Coût Alimentaire','nav.manual':'Manuel',
      'nav.allerq':'MenuGuard','nav.labels':'LabelSmart','nav.waste':'WasteWise','nav.settings':'Paramètres',
      'nav.products':'Produits','nav.liveops':'Opérations en direct',
      'top.live':'En direct','top.search':'Rechercher ou aller à… (Ctrl K)',
    },
    de: {
      'lang.name':'Deutsch',
      'nav.home':'Start','nav.wflive':'Aktiv jetzt','nav.wfdone':'Heute erledigt','nav.wfout':'Offen','nav.wfod':'Überfällig','nav.wfstaff':'Aktives Personal','nav.wfdel':'Lieferungen heute','nav.wfprod':'Produktion','nav.wfclean':'Reinigung','nav.wfhaccp':'HACCP-Status','nav.wfperf':'Leistung','nav.dashboard':'Übersicht','nav.taskoverview':'Aufgabenübersicht','nav.deliveries':'Lieferungen','nav.temps':'Temperaturen','nav.alerts':'Warnungen',
      'nav.haccp':'HACCP & Checklisten','nav.records':'Protokolle','nav.sites':'Standorte',
      'nav.suppliers':'Lieferanten','nav.incidents':'Vorfälle','nav.training':'Schulungen','nav.maintenance':'Wartung',
      'nav.cooling':'Abkühlung','nav.holding':'Warm-/Kalthaltung','nav.phlogs':'pH-Überwachung','nav.batches':'Chargen','nav.assets':'Anlagen & Geräte',
      'nav.reports':'Berichte','nav.team':'Team','nav.recipes':'Rezepte','nav.foodcost':'Lebensmittelkosten','nav.manual':'Handbuch',
      'nav.allerq':'MenuGuard','nav.labels':'LabelSmart','nav.waste':'WasteWise','nav.settings':'Einstellungen',
      'nav.products':'Produkte','nav.liveops':'Live-Betrieb',
      'top.live':'Live','top.search':'Suchen oder springen… (Strg K)',
    },
  };

  // Multilingual user manual (concise, original instructional content)
  const manual = {
    en: {
      intro: 'Welcome to Kiteline — one platform for food safety, allergens, labelling, recipes and waste. This manual walks you through every module.',
      sections: [
        { t:'Getting started', b:['Sign in with your email and password. One account unlocks every module.','Use the site selector at the top to switch between your kitchens.','Press Ctrl K (or ⌘ K on Mac) anywhere to open the command palette and jump to any screen.'] },
        { t:'SafeServe — Temperature monitoring', b:['Wireless LoRaWAN sensors stream fridge, freezer and hot-hold temperatures 24/7.','Each card shows the live reading, battery, signal and a trend graph with safe-range limits.','Use "Manual reading" to log a probe check, or "Add sensor" to register new equipment.'] },
        { t:'Alerts', b:['Breaches and overdue tasks raise alerts automatically.','Acknowledge an alert to mark you are aware; Resolve it once fixed.','Choose SMS, email and push channels — these apply to every site.'] },
        { t:'HACCP & Checklists', b:['Open daily checklists, tick items as you complete them, and add ad-hoc tasks.','Each completion is recorded against the logged-in user for a full audit trail.','Create new recurring checklists per site with an assignee and due time.'] },
        { t:'Records', b:['Log delivery, cooking, cooling, reheating and sanitization records.','Every record is timestamped and attributed to a team member.','Export the full log to CSV for inspections.'] },
        { t:'Recipes', b:['Build standardised recipe cards with a photo, ingredients, method, allergens and food cost.','Click "Add recipe" and upload a photo — it is resized and stored automatically.','Use "Label" on any recipe to instantly create a compliant date label.'] },
        { t:'MenuGuard — Allergen menus', b:['Create menus and add dishes with their 14 statutory allergens.','Generate a QR code so guests can view allergens in multiple languages.'] },
        { t:'LabelSmart — Food labels', b:['Create a label with product, prep date and shelf life; the use-by date is calculated automatically.','Each label includes allergens, a QR code and a barcode, ready to print.'] },
        { t:'WasteWise — Waste tracking', b:['Log waste by item, weight, reason and stage.','Charts break down waste by reason and stage so you can target the biggest losses.'] },
        { t:'Sites & Reports', b:['Manage every kitchen from one dashboard and switch the active site at the top.','Generate an audit-ready compliance report and export or print it for your EHO.'] },
        { t:'Settings', b:['Update your organisation name, currency, active products and notification channels.','Use "Reset demo data" to restore the sample content.'] },
      ],
    },
    es: {
      intro: 'Bienvenido a Kiteline — una plataforma para seguridad alimentaria, alérgenos, etiquetado, recetas y residuos. Este manual explica cada módulo.',
      sections: [
        { t:'Primeros pasos', b:['Inicie sesión con su correo y contraseña. Una cuenta da acceso a todos los módulos.','Use el selector de sede en la parte superior para cambiar de cocina.','Pulse Ctrl K (o ⌘ K en Mac) para abrir la paleta de comandos y saltar a cualquier pantalla.'] },
        { t:'SafeServe — Control de temperatura', b:['Los sensores inalámbricos LoRaWAN transmiten las temperaturas de neveras, congeladores y mantenimiento en caliente 24/7.','Cada tarjeta muestra la lectura en vivo, batería, señal y un gráfico de tendencia con los límites seguros.','Use "Lectura manual" para registrar una sonda o "Añadir sensor" para nuevos equipos.'] },
        { t:'Alertas', b:['Las desviaciones y tareas vencidas generan alertas automáticamente.','Confirme una alerta para indicar que la conoce; Resuélvala cuando se solucione.','Elija canales de SMS, correo y notificaciones — se aplican a todas las sedes.'] },
        { t:'APPCC y Listas', b:['Abra las listas diarias, marque los puntos completados y añada tareas puntuales.','Cada finalización se registra con el usuario para una auditoría completa.','Cree nuevas listas periódicas por sede con responsable y hora límite.'] },
        { t:'Registros', b:['Registre recepción, cocción, enfriamiento, recalentamiento y desinfección.','Cada registro lleva fecha/hora y responsable.','Exporte el registro completo a CSV para inspecciones.'] },
        { t:'Recetas', b:['Cree fichas de receta con foto, ingredientes, método, alérgenos y coste.','Pulse "Añadir receta" y suba una foto — se redimensiona y guarda automáticamente.','Use "Etiqueta" en cualquier receta para crear una etiqueta de caducidad al instante.'] },
        { t:'MenuGuard — Menús de alérgenos', b:['Cree menús y añada platos con sus 14 alérgenos reglamentarios.','Genere un código QR para que los clientes consulten los alérgenos en varios idiomas.'] },
        { t:'LabelSmart — Etiquetas', b:['Cree una etiqueta con producto, fecha de preparación y vida útil; la fecha de caducidad se calcula sola.','Cada etiqueta incluye alérgenos, código QR y código de barras, lista para imprimir.'] },
        { t:'WasteWise — Residuos', b:['Registre residuos por artículo, peso, motivo y etapa.','Los gráficos desglosan los residuos por motivo y etapa para reducir las mayores pérdidas.'] },
        { t:'Sedes e Informes', b:['Gestione todas las cocinas desde un panel y cambie la sede activa arriba.','Genere un informe de cumplimiento listo para auditoría y expórtelo o imprímalo.'] },
        { t:'Ajustes', b:['Actualice el nombre de la organización, la moneda, los productos y los canales de notificación.','Use "Restablecer datos" para restaurar el contenido de ejemplo.'] },
      ],
    },
    fr: {
      intro: 'Bienvenue dans Kiteline — une plateforme pour la sécurité alimentaire, les allergènes, l’étiquetage, les recettes et les déchets. Ce manuel présente chaque module.',
      sections: [
        { t:'Démarrage', b:['Connectez-vous avec votre e-mail et mot de passe. Un compte donne accès à tous les modules.','Utilisez le sélecteur de site en haut pour changer de cuisine.','Appuyez sur Ctrl K (ou ⌘ K sur Mac) pour ouvrir la palette de commandes et accéder à tout écran.'] },
        { t:'SafeServe — Suivi des températures', b:['Les capteurs LoRaWAN sans fil transmettent les températures des frigos, congélateurs et maintien au chaud 24h/24.','Chaque carte affiche la lecture en direct, la batterie, le signal et un graphique avec les limites de sécurité.','Utilisez « Relevé manuel » pour une sonde ou « Ajouter un capteur » pour un nouvel équipement.'] },
        { t:'Alertes', b:['Les dépassements et tâches en retard déclenchent des alertes automatiquement.','Accusez réception d’une alerte ; Résolvez-la une fois corrigée.','Choisissez les canaux SMS, e-mail et push — ils s’appliquent à tous les sites.'] },
        { t:'HACCP et Listes', b:['Ouvrez les listes quotidiennes, cochez les éléments et ajoutez des tâches ponctuelles.','Chaque validation est enregistrée pour une traçabilité complète.','Créez des listes récurrentes par site avec un responsable et une échéance.'] },
        { t:'Registres', b:['Enregistrez réception, cuisson, refroidissement, remise en température et désinfection.','Chaque enregistrement est horodaté et attribué à un membre.','Exportez le journal complet en CSV pour les inspections.'] },
        { t:'Recettes', b:['Créez des fiches recette avec photo, ingrédients, méthode, allergènes et coût.','Cliquez sur « Ajouter une recette » et chargez une photo — redimensionnée et stockée automatiquement.','Utilisez « Étiquette » sur une recette pour créer une étiquette de DLC instantanément.'] },
        { t:'MenuGuard — Menus allergènes', b:['Créez des menus et ajoutez des plats avec leurs 14 allergènes réglementaires.','Générez un QR code pour que les clients consultent les allergènes en plusieurs langues.'] },
        { t:'LabelSmart — Étiquettes', b:['Créez une étiquette avec produit, date de préparation et durée de vie ; la DLC est calculée automatiquement.','Chaque étiquette inclut allergènes, QR code et code-barres, prête à imprimer.'] },
        { t:'WasteWise — Déchets', b:['Enregistrez les déchets par article, poids, motif et étape.','Les graphiques répartissent les déchets par motif et étape pour cibler les pertes.'] },
        { t:'Sites et Rapports', b:['Gérez toutes les cuisines depuis un tableau de bord et changez le site actif en haut.','Générez un rapport de conformité prêt pour l’audit et exportez-le ou imprimez-le.'] },
        { t:'Paramètres', b:['Modifiez le nom de l’organisation, la devise, les produits et les canaux de notification.','Utilisez « Réinitialiser » pour restaurer le contenu d’exemple.'] },
      ],
    },
  };

  const I18n = {
    langs: ['en','es','fr','de'],
    lang: localStorage.getItem(LANG_KEY) || 'en',
    setLang(l) { this.lang = l; localStorage.setItem(LANG_KEY, l); },
    t(key) { return (dict[this.lang] && dict[this.lang][key]) || dict.en[key] || key; },
    manual(l) { return manual[l || this.lang] || manual.en; },
    langName(l) { return (dict[l] && dict[l]['lang.name']) || l; },
  };

  window.I18n = I18n;
})();
