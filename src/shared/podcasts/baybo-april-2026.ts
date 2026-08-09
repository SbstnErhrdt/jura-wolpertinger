import type { PodcastCatalog } from '../schemas'

export const BAYBO_PODCAST_SERIES_ID = 'ba7b2026-0400-4000-8000-000000000001'
export const BAYBO_PODCAST_SLUG = 'baybo-april-2026'

const AUDIO_BASE_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/baybo-april-2026'

const episodes = [
  {
    slug: 'regelungsgegenstand-und-grundbegriffe',
    title: 'Regelungsgegenstand und Grundbegriffe der BayBO',
    description: 'Anwendungsbereich, Anlagenbegriff, Gebäude und Gebäudeklassen systematisch erklärt.',
    durationSeconds: 703.392
  },
  {
    slug: 'sonderbauten-vollgeschosse-und-baubeteiligte',
    title: 'Sonderbauten, Vollgeschosse und Verantwortliche am Bau',
    description: 'Sonderbauten, Vollgeschosse und die Rollen der am Bau Beteiligten.',
    durationSeconds: 747.984
  },
  {
    slug: 'bauaufsicht-und-nutzungsaenderung',
    title: 'Bauaufsichtsorganisation und Nutzungsänderung',
    description: 'Zuständigkeiten der Bauaufsicht und die rechtliche Einordnung von Nutzungsänderungen.',
    durationSeconds: 883.344
  },
  {
    slug: 'verfahrensfreiheit-konkurrenz-und-freistellung',
    title: 'Verfahrensfreiheit, Verfahrenskonkurrenz und Einstieg in die Freistellung',
    description: 'Der Weg zum richtigen bauordnungsrechtlichen Verfahren.',
    durationSeconds: 761.136
  },
  {
    slug: 'genehmigungsfreistellung-im-detail',
    title: 'Genehmigungsfreistellung im Detail',
    description: 'Voraussetzungen, Ablauf und Rechtsfolgen der Genehmigungsfreistellung.',
    durationSeconds: 823.176
  },
  {
    slug: 'nachbarrechtsschutz-und-genehmigungsschema',
    title: 'Nachbarrechtsschutz und Grundschema der Baugenehmigung',
    description: 'Nachbarschützende Normen und ein belastbares Prüfungsschema für die Baugenehmigung.',
    durationSeconds: 765.792
  },
  {
    slug: 'bauantrag-vollstaendigkeit-und-gemeinde',
    title: 'Bauantrag, Vollständigkeit und Beteiligung der Gemeinde',
    description: 'Vom vollständigen Bauantrag bis zur Beteiligung der Gemeinde.',
    durationSeconds: 792.84
  },
  {
    slug: 'nachbar-und-fachstellenbeteiligung',
    title: 'Nachbar- und Fachstellenbeteiligung im Genehmigungsverfahren',
    description: 'Beteiligungsrechte von Nachbarn und Fachstellen im Genehmigungsverfahren.',
    durationSeconds: 824.136
  },
  {
    slug: 'genehmigungsfiktion-und-pruefprogramme',
    title: 'Genehmigungsfiktion, Prüfprogramme und Feststellungswirkung',
    description: 'Genehmigungsfiktion, Prüfungsumfang und Reichweite der Baugenehmigung.',
    durationSeconds: 944.424
  },
  {
    slug: 'rechtsnatur-bestandsschutz-und-vorbescheid',
    title: 'Rechtsnatur der Baugenehmigung, Bestandsschutz und Vorbescheid',
    description: 'Rechtsnatur, Bestandsschutz und die Bindungswirkung des Vorbescheids.',
    durationSeconds: 867.936
  },
  {
    slug: 'teilbaugenehmigung-abweichung-und-aufsicht',
    title: 'Teilbaugenehmigung, Abweichung und Grundlagen der Bauaufsicht',
    description: 'Teilbaugenehmigung, Abweichungsentscheidung und bauaufsichtliche Grundlagen.',
    durationSeconds: 871.944
  },
  {
    slug: 'baueinstellung-und-versiegelung',
    title: 'Baueinstellung und Versiegelung',
    description: 'Voraussetzungen, Ermessen und Durchsetzung von Baueinstellung und Versiegelung.',
    durationSeconds: 802.536
  },
  {
    slug: 'baubeseitigung-illegalitaet-und-bestandsschutz',
    title: 'Baubeseitigung: Illegalität, Zeitpunkt und Grundformen des Bestandsschutzes',
    description: 'Formelle und materielle Illegalität sowie die Grundformen des Bestandsschutzes.',
    durationSeconds: 843.84
  },
  {
    slug: 'legalisierungswirkung-stoerer-und-mildere-mittel',
    title: 'Legalisierungswirkung, Störerauswahl und mildere Mittel der Baubeseitigung',
    description: 'Legalisierung, richtige Adressaten und verhältnismäßige Alternativen zur Beseitigung.',
    durationSeconds: 833.784
  },
  {
    slug: 'ermessen-drittansprueche-und-vollstreckung-der-beseitigung',
    title: 'Ermessen, Drittansprüche und Vollstreckung der Baubeseitigung',
    description: 'Ermessensausübung, Nachbaransprüche und Vollstreckung einer Beseitigungsanordnung.',
    durationSeconds: 794.424
  },
  {
    slug: 'nutzungsuntersagung',
    title: 'Nutzungsuntersagung nach Art. 76 Satz 2',
    description: 'Tatbestand, Ermessen und Rechtsschutz bei der Nutzungsuntersagung.',
    durationSeconds: 909.48
  },
  {
    slug: 'sonstige-eingriffsbefugnisse-und-abstandsflaechen-grundlagen',
    title: 'Sonstige Eingriffsbefugnisse und Grundlagen des Abstandsflächenrechts',
    description: 'Weitere bauaufsichtliche Befugnisse und der Einstieg in das Abstandsflächenrecht.',
    durationSeconds: 697.344
  },
  {
    slug: 'berechnung-und-lage-der-abstandsflaechen',
    title: 'Berechnung, Tiefe und Lage der Abstandsflächen',
    description: 'Abstandsflächen sicher berechnen und ihre zulässige Lage bestimmen.',
    durationSeconds: 708.888
  }
] as const

export const BAYBO_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'oeffentliches-recht',
      name: 'Öffentliches Recht',
      series: [
        {
          id: BAYBO_PODCAST_SERIES_ID,
          slug: BAYBO_PODCAST_SLUG,
          title: 'Bayerische Bauordnung: Grundlagen, Verfahren, Bauaufsicht und Abstandsflächenrecht',
          description:
            'Eine 18-teilige Lernreihe zur Bayerischen Bauordnung, vom Grundbegriff bis zur Abstandsfläche.',
          edition: 'April 2026',
          artworkUrl: null,
          episodes: episodes.map((episode, index) => {
            const number = index + 1
            const directory = `${String(number).padStart(2, '0')}-${episode.slug}`
            return {
              id: `ba7b2026-0400-4000-8000-${String(100 + number).padStart(12, '0')}`,
              seriesId: BAYBO_PODCAST_SERIES_ID,
              slug: episode.slug,
              number,
              title: episode.title,
              description: episode.description,
              durationSeconds: episode.durationSeconds,
              audioUrl: `${AUDIO_BASE_URL}/${directory}.mp3`,
              publishedAt: '2026-04-01T00:00:00.000Z',
              progress: null
            }
          })
        }
      ]
    }
  ]
}
