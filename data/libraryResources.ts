export interface LibraryResource {
    id: string;
    category: 'study-techniques' | 'productivity-tools' | 'writing-aids' | 'research-databases' | 'digital-book-libraries';
    titleKey: string;
    descriptionKey: string;
    link: string;
}

export const libraryResources: LibraryResource[] = [
    {
        id: 'st1',
        category: 'study-techniques',
        titleKey: 'library.resources.st1.title',
        descriptionKey: 'library.resources.st1.description',
        link: 'https://francescocirillo.com/pages/pomodoro-technique',
    },
    {
        id: 'st2',
        category: 'study-techniques',
        titleKey: 'library.resources.st2.title',
        descriptionKey: 'library.resources.st2.description',
        link: 'https://www.youtube.com/watch?v=fDbxPVn02_c',
    },
    {
        id: 'st3',
        category: 'study-techniques',
        titleKey: 'library.resources.st3.title',
        descriptionKey: 'library.resources.st3.description',
        link: 'https://ncase.me/remember/',
    },
    {
        id: 'pt1',
        category: 'productivity-tools',
        titleKey: 'library.resources.pt1.title',
        descriptionKey: 'library.resources.pt1.description',
        link: 'https://www.notion.so',
    },
    {
        id: 'pt2',
        category: 'productivity-tools',
        titleKey: 'library.resources.pt2.title',
        descriptionKey: 'library.resources.pt2.description',
        link: 'https://apps.ankiweb.net/',
    },
    {
        id: 'pt3',
        category: 'productivity-tools',
        titleKey: 'library.resources.pt3.title',
        descriptionKey: 'library.resources.pt3.description',
        link: 'https://www.forestapp.cc/',
    },
    {
        id: 'wa1',
        category: 'writing-aids',
        titleKey: 'library.resources.wa1.title',
        descriptionKey: 'library.resources.wa1.description',
        link: 'https://www.grammarly.com',
    },
    {
        id: 'wa2',
        category: 'writing-aids',
        titleKey: 'library.resources.wa2.title',
        descriptionKey: 'library.resources.wa2.description',
        link: 'https://www.zotero.org',
    },
    {
        id: 'wa3',
        category: 'writing-aids',
        titleKey: 'library.resources.wa3.title',
        descriptionKey: 'library.resources.wa3.description',
        link: 'https://hemingwayapp.com/',
    },
    {
        id: 'rd1',
        category: 'research-databases',
        titleKey: 'library.resources.rd1.title',
        descriptionKey: 'library.resources.rd1.description',
        link: 'https://scholar.google.com',
    },
    {
        id: 'rd2',
        category: 'research-databases',
        titleKey: 'library.resources.rd2.title',
        descriptionKey: 'library.resources.rd2.description',
        link: 'https://www.jstor.org',
    },
    {
        id: 'rd3',
        category: 'research-databases',
        titleKey: 'library.resources.rd3.title',
        descriptionKey: 'library.resources.rd3.description',
        link: 'https://pubmed.ncbi.nlm.nih.gov/',
    },
    {
        id: 'dbl1',
        category: 'digital-book-libraries',
        titleKey: 'library.resources.dbl1.title',
        descriptionKey: 'library.resources.dbl1.description',
        link: 'https://www.gutenberg.org/',
    },
    {
        id: 'dbl2',
        category: 'digital-book-libraries',
        titleKey: 'library.resources.dbl2.title',
        descriptionKey: 'library.resources.dbl2.description',
        link: 'https://openlibrary.org/',
    },
    {
        id: 'dbl3',
        category: 'digital-book-libraries',
        titleKey: 'library.resources.dbl3.title',
        descriptionKey: 'library.resources.dbl3.description',
        link: 'https://books.google.com/',
    },
];