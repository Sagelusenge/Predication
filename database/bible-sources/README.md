# Sources bibliques

Ces fichiers VPL compressés proviennent des archives officielles proposées par
[eBible.org](https://ebible.org/). Ils sont importés dans PostgreSQL au premier
démarrage, puis ignorés aux démarrages suivants tant que la traduction est complète.

| Fichier | Traduction | Source | Licence |
| --- | --- | --- | --- |
| `fraLSG.vpl.txt.gz` | Louis Segond 1910 | https://ebible.org/bible/details.php?id=fraLSG | Domaine public |
| `engwebp.vpl.txt.gz` | World English Bible | https://ebible.org/bible/details.php?id=engwebp | Public Domain |
| `swhulb.vpl.txt.gz` | Swahili Unlocked Literal Bible | https://ebible.org/bible/details.php?id=swhulb | CC BY-SA 4.0, © 2019 Door43 World Missions Community |

Le texte des versets n’est pas modifié. L’importeur retire uniquement les espaces
de début et de fin propres au format d’échange.
