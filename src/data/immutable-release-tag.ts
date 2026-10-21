type Release={assetUrl:string;bodySha256:string;sha256:string};
/** A current or retained release tag can only replay its exact immutable bytes. */
export function assertImmutableReleaseTag(tag:string,bodySha256:string,sha256:string,releases:readonly Release[]){
  for(const release of releases){const parts=new URL(release.assetUrl).pathname.split("/");
    if(decodeURIComponent(parts.at(-2)??"")===tag&&(release.bodySha256!==bodySha256||release.sha256!==sha256))throw Error("Immutable release tag already reserved by active or retained bytes");
  }
}
