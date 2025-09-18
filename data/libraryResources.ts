export interface LibraryResource {
    id: string;
    category: 'study-techniques' | 'productivity-tools' | 'writing-aids' | 'research-databases';
    title: string;
    description: string;
    link: string;
}

export const libraryResources: LibraryResource[] = [
    {
        id: 'st1',
        category: 'study-techniques',
        title: 'The Pomodoro Technique',
        description: 'A time management method that uses a timer to break down work into intervals, traditionally 25 minutes in length, separated by short breaks.',
        link: 'https://francescocirillo.com/pages/pomodoro-technique',
    },
    {
        id: 'st2',
        category: 'study-techniques',
        title: 'Active Recall',
        description: 'A process of actively stimulating memory during the learning process. It contrasts with passive review, where the learning material is processed passively.',
        link: 'https://www.youtube.com/watch?v=fDbxPVn02_c',
    },
    {
        id: 'st3',
        category: 'study-techniques',
        title: 'Spaced Repetition',
        description: 'An evidence-based learning technique that is usually performed with flashcards. Newly introduced and more difficult flashcards are shown more frequently, while older and less difficult flashcards are shown less frequently.',
        link: 'https://ncase.me/remember/',
    },
    {
        id: 'pt1',
        category: 'productivity-tools',
        title: 'Notion',
        description: 'An all-in-one workspace for your notes, tasks, wikis, and databases. It\'s a versatile tool for students to organize their entire academic life.',
        link: 'https://www.notion.so',
    },
    {
        id: 'pt2',
        category: 'productivity-tools',
        title: 'Anki',
        description: 'A powerful, intelligent flashcard program that makes remembering things easy. It\'s highly effective for implementing spaced repetition.',
        link: 'https://apps.ankiweb.net/',
    },
    {
        id: 'pt3',
        category: 'productivity-tools',
        title: 'Forest',
        description: 'An app that helps you stay focused on your work by planting a virtual tree. If you leave the app, your tree withers.',
        link: 'https://www.forestapp.cc/',
    },
    {
        id: 'wa1',
        category: 'writing-aids',
        title: 'Grammarly',
        description: 'A writing assistant that checks for spelling, grammar, punctuation, clarity, engagement, and delivery mistakes in English texts.',
        link: 'https://www.grammarly.com',
    },
    {
        id: 'wa2',
        category: 'writing-aids',
        title: 'Zotero',
        description: 'A free and open-source reference management software to manage bibliographic data and related research materials.',
        link: 'https://www.zotero.org',
    },
    {
        id: 'wa3',
        category: 'writing-aids',
        title: 'Hemingway App',
        description: 'An app that makes your writing bold and clear. It highlights long, complex sentences and common errors.',
        link: 'https://hemingwayapp.com/',
    },
    {
        id: 'rd1',
        category: 'research-databases',
        title: 'Google Scholar',
        description: 'A freely accessible web search engine that indexes the full text or metadata of scholarly literature across an array of publishing formats and disciplines.',
        link: 'https://scholar.google.com',
    },
    {
        id: 'rd2',
        category: 'research-databases',
        title: 'JSTOR',
        description: 'A digital library providing access to more than 12 million academic journal articles, books, and primary sources in 75 disciplines.',
        link: 'https://www.jstor.org',
    },
    {
        id: 'rd3',
        category: 'research-databases',
        title: 'PubMed',
        description: 'A free search engine accessing primarily the MEDLINE database of references and abstracts on life sciences and biomedical topics.',
        link: 'https://pubmed.ncbi.nlm.nih.gov/',
    },
];
