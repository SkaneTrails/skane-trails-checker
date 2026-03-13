/**
 * English translations — source of truth for all UI strings.
 * Swedish locale (sv.ts) must have the same keys.
 *
 * Interpolation: use {{variable}} for dynamic values.
 */

const en = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    loading: 'Loading...',
    saving: 'Saving...',
    retry: 'Retry',
    goBack: 'Go Back',
    all: 'All',
    close: 'Close',
  },

  tabs: {
    map: 'Map',
    trails: 'Trails',
    foraging: 'Foraging',
    places: 'Places',
    settings: 'Settings',
  },

  signIn: {
    title: 'Skåne Trails',
    subtitle: 'Explore hiking trails in Skåne',
    continueWithGoogle: 'Continue with Google',
    syncNote: 'Your trail data syncs across devices',
    signOut: 'Sign Out',
  },

  trails: {
    explored: 'Explored',
    toExplore: 'To Explore',
    exploredCount: '🥾 {{explored}} / {{total}} explored',
    uploadGpx: '📤 Upload GPX',
    searchPlaceholder: 'Search trails...',
    loadingTrails: 'Loading trails...',
    noTrailsFound: 'No trails found',
    failedToLoad: 'Failed to load trails',
    distance: '📏 {{km}} km',
    difficulty: '⛰️ {{level}}',
    source: '📂 {{source}}',
  },

  places: {
    loadingPlaces: 'Loading places...',
    failedToLoad: 'Failed to load places',
    noPlacesFound: 'No places found',
    coordinates: '📍 {{lat}}, {{lng}}',
    webLink: '🔗 {{url}}',
  },

  foraging: {
    mapWebOnly: 'Map is currently available on web only',
    mapRequiresBrowser: 'Foraging map requires a web browser.',
    month: '📅 {{month}}',
    coordinates: '📍 {{lat}}, {{lng}}',
    addSpot: '+ Add Spot',
    addSpotAccessibility: 'Add foraging spot',
    couldNotLoad: 'Could not load foraging spots',
    editSpot: 'Edit',
    notesLabel: 'Notes',
    monthLabel: 'Month',
    typeLabel: 'Type',
  },

  map: {
    webOnly: 'Map is currently available on web only',
    useTrailsTab: 'Use the Trails tab to see your trails.',
    couldNotConnect: 'Could not connect to API',
  },

  trail: {
    title: 'Trail Details',
    loadingTrail: 'Loading trail...',
    trailNotFound: 'Trail not found',
    distance: 'Distance',
    elevationGain: 'Elevation Gain',
    elevationLoss: 'Elevation Loss',
    difficultyLabel: 'Difficulty',
    exploredStatus: '✅ Explored!',
    markExplored: '🔴 Mark as Explored',
    updating: 'Updating...',
    info: 'Info',
    sourceLabel: 'Source',
    statusLabel: 'Status',
    updatedLabel: 'Updated',
    activityLabel: 'Activity',
    typeLabel: 'Type',
    trackPoints: 'Track Points',
    trailName: 'Trail Name',
    rename: '✏️ Rename',
    deleteTrail: '🗑️ Delete',
    deleteConfirm: 'Delete "{{name}}"? This cannot be undone.',
  },

  upload: {
    title: 'Upload GPX',
    heading: 'Upload GPX File',
    description:
      'Upload a .gpx file to add trails. Uploaded trails are automatically marked as explored.',
    trailSource: 'Trail Source',
    otherTrails: 'Other Trails',
    worldWideHikes: 'World Wide Hikes',
    upload: '📤 Upload',
    uploading: 'Uploading...',
    uploadFailed: 'Upload failed',
    uploadSuccess: '✅ {{count}} trail(s) uploaded successfully!',
    viewTrails: 'View Trails',
    webOnly: 'GPX upload is currently available on web only',
  },

  addSpot: {
    title: 'Add Foraging Spot',
    type: 'Type',
    month: 'Month',
    location: 'Location',
    useCurrentLocation: '📍 Use Current Location',
    orTapMap: 'or tap on the map, or enter manually:',
    latitude: 'Latitude',
    longitude: 'Longitude',
    notes: 'Notes',
    notesPlaceholder: 'Any observations...',
    addSpot: 'Add Spot',
  },

  trailCard: {
    viewDetails: 'View Details',
    edit: 'Edit',
    elevationGain: '↗ {{meters}} m',
    elevationLoss: '↘ {{meters}} m',
  },

  months: {
    jan: 'Jan',
    feb: 'Feb',
    mar: 'Mar',
    apr: 'Apr',
    may: 'May',
    jun: 'Jun',
    jul: 'Jul',
    aug: 'Aug',
    sep: 'Sep',
    oct: 'Oct',
    nov: 'Nov',
    dec: 'Dec',
  },

  settings: {
    title: 'Settings',
    hikeGroup: 'Hike Group',
    language: 'Language',
    theme: 'Theme',
    noGroup: 'No hike group yet',
    createGroup: 'Create Group',
    groupName: 'Group Name',
    members: 'Members',
    addMember: 'Add Member',
    emailPlaceholder: 'Email address',
    removeMember: 'Remove',
    owner: 'Owner',
    member: 'Member',
    leaveGroup: 'Leave Group',
    deleteGroup: 'Delete Group',
    deleteGroupConfirm: 'Delete "{{name}}"? All members will be removed.',
    english: 'English',
    swedish: 'Svenska',
    outdoor: 'Outdoor',
    onlyTheme: 'Currently the only available theme',
    groupSettings: 'Group Settings',
    account: 'Account',
    signOut: 'Sign Out',
  },
};

/** Recursive type mapping every leaf to `string`. */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Translations = DeepStringify<typeof en>;

export default en;
